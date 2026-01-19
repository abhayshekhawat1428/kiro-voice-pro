import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { SetupManager } from './setupManager';

let statusBarItem: vscode.StatusBarItem;
let voiceProcess: cp.ChildProcess | null = null;
const SETUP_COMPLETE_KEY = 'kiroVoice.setupComplete';

export async function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'kiro.toggleVoice';
    statusBarItem.text = '$(mic) Voice';
    statusBarItem.show();

    const disposable = vscode.commands.registerCommand('kiro.toggleVoice', async () => {
        if (voiceProcess) {
            stopListening();
        } else {
            await startListening(context);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(statusBarItem);

    // Check if first-time setup is needed
    const setupComplete = context.globalState.get<boolean>(SETUP_COMPLETE_KEY, false);
    if (!setupComplete) {
        await runFirstTimeSetup(context);
    }
}

async function runFirstTimeSetup(context: vscode.ExtensionContext): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
        'Welcome to Kiro Voice! Let\'s set up permissions for voice recording and auto-paste.',
        'Setup Now',
        'Later'
    );

    if (choice !== 'Setup Now') {
        return;
    }

    // Step 1: Check/request microphone permission (macOS)
    if (process.platform === 'darwin') {
        await vscode.window.showInformationMessage(
            'Step 1/2: Microphone Permission\n\n' +
            'When you click OK, a test recording will start. ' +
            'Please allow microphone access when prompted by macOS.',
            'OK'
        );

        // Trigger microphone permission by attempting a short recording
        const testMicPermission = await testMicrophoneAccess(context);
        if (!testMicPermission) {
            const openSettings = await vscode.window.showWarningMessage(
                'Microphone access was denied. Please enable it in System Settings.',
                'Open Settings',
                'Skip'
            );
            if (openSettings === 'Open Settings') {
                cp.exec('open x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
            }
        }

        // Step 2: Check/request accessibility permission
        await vscode.window.showInformationMessage(
            'Step 2/2: Accessibility Permission\n\n' +
            'Kiro Voice needs Accessibility permission to auto-paste text. ' +
            'Please enable it in System Settings when prompted.',
            'OK'
        );

        const hasAccessibility = await testAccessibilityPermission();
        if (!hasAccessibility) {
            const openSettings = await vscode.window.showWarningMessage(
                'Accessibility permission is needed for auto-paste. ' +
                'Without it, you\'ll need to manually press Cmd+V to paste.',
                'Open Settings',
                'Skip'
            );
            if (openSettings === 'Open Settings') {
                cp.exec('open x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
            }
        }
    }

    // Mark setup as complete
    await context.globalState.update(SETUP_COMPLETE_KEY, true);
    
    vscode.window.showInformationMessage(
        'Setup complete! Click the 🎤 Voice button in the status bar to start.',
        'Got it'
    );
}

async function testMicrophoneAccess(context: vscode.ExtensionContext): Promise<boolean> {
    return new Promise((resolve) => {
        const config = vscode.workspace.getConfiguration('kiroVoice');
        const useLocalPython = config.get<boolean>('useLocalPython') || false;
        
        let command: string;
        let args: string[];

        if (useLocalPython) {
            const pythonPath = config.get<string>('pythonPath') || 'python';
            // Quick test script to trigger mic permission
            command = pythonPath;
            args = ['-c', 'import sounddevice as sd; sd.rec(100, samplerate=44100, channels=1); sd.wait(); print("OK")'];
        } else {
            // For production, we'll just assume the binary will request permission
            resolve(true);
            return;
        }

        const testProcess = cp.spawn(command, args, { timeout: 10000 });
        let output = '';
        
        testProcess.stdout?.on('data', (data) => {
            output += data.toString();
        });

        testProcess.on('close', (code) => {
            resolve(code === 0 || output.includes('OK'));
        });

        testProcess.on('error', () => {
            resolve(false);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            testProcess.kill();
            resolve(false);
        }, 10000);
    });
}

async function testAccessibilityPermission(): Promise<boolean> {
    return new Promise((resolve) => {
        cp.exec(
            'osascript -e \'tell application "System Events" to keystroke ""\'',
            (error, _stdout, stderr) => {
                const output = stderr || '';
                if (error || output.includes('not allowed') || output.includes('1002')) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

async function startListening(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('kiroVoice');
    const useLocalPython = config.get<boolean>('useLocalPython') || false;
    const silenceDuration = config.get<number>('silenceDuration') || 3.0;
    const silenceThreshold = config.get<number>('silenceThreshold') || 0.01;

    statusBarItem.text = '$(sync~spin) Init...';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

    let command: string;
    let args: string[];

    if (useLocalPython) {
        // Development mode: use Python directly
        const pythonPath = config.get<string>('pythonPath') || 'python';
        const scriptPath = path.join(context.extensionPath, 'python', 'voice_engine.py');
        command = pythonPath;
        args = [scriptPath, `--duration=${silenceDuration}`, `--threshold=${silenceThreshold}`];
    } else {
        // Production mode: use pre-compiled binary
        const engineReady = await SetupManager.ensureVoiceEngine(context);
        if (!engineReady) {
            vscode.window.showErrorMessage('Voice engine not available. Enable "Use Local Python" in settings for development.');
            statusBarItem.text = '$(mic) Voice';
            statusBarItem.backgroundColor = undefined;
            return;
        }
        command = SetupManager.getEnginePath(context);
        args = [`--duration=${silenceDuration}`, `--threshold=${silenceThreshold}`];
    }

    voiceProcess = cp.spawn(command, args);

    let capturedOutput = '';

    voiceProcess.stdout?.on('data', (data) => {
        capturedOutput += data.toString();
    });

    voiceProcess.stderr?.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes("READY_TO_RECORD")) {
            statusBarItem.text = '$(record) Listening...';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    });

    voiceProcess.on('error', (err) => {
        // Check for macOS Gatekeeper block
        if (process.platform === 'darwin' && (err.message.includes('EACCES') || err.message.includes('permission'))) {
            vscode.window.showErrorMessage(
                'macOS blocked the voice engine. Go to System Settings → Privacy & Security and click "Open Anyway" for kiro_voice_engine_macos.',
                'Open Settings',
                'Use Python Instead'
            ).then(choice => {
                if (choice === 'Open Settings') {
                    cp.exec('open x-apple.systempreferences:com.apple.preference.security?General');
                } else if (choice === 'Use Python Instead') {
                    vscode.workspace.getConfiguration('kiroVoice').update('useLocalPython', true, true);
                    vscode.window.showInformationMessage('Switched to Python mode. Click Voice again to start.');
                }
            });
        } else {
            vscode.window.showErrorMessage(`Failed to start voice engine: ${err.message}`);
        }
        statusBarItem.text = '$(mic) Voice';
        statusBarItem.backgroundColor = undefined;
        voiceProcess = null;
    });

    voiceProcess.on('close', async (code) => {
        voiceProcess = null;
        
        const rawText = capturedOutput.trim();

        if (code === 0 && rawText) {
            statusBarItem.text = '$(mic) Voice';
            statusBarItem.backgroundColor = undefined;
            insertText(rawText);
        } else {
            statusBarItem.text = '$(mic) Voice';
            statusBarItem.backgroundColor = undefined;
            if (!rawText) {
                vscode.window.setStatusBarMessage('$(warning) No voice detected', 3000);
            }
        }
    });
}

function stopListening() {
    if (voiceProcess) {
        statusBarItem.text = '$(sync~spin) Processing...';
        voiceProcess.stdin?.write("STOP\n");
    }
}

async function insertText(text: string) {
    // Always copy to clipboard first (needed for webview paste)
    await vscode.env.clipboard.writeText(text);
    
    // Try AppleScript paste first (works for webviews on macOS)
    // This simulates Cmd+V which pastes wherever focus actually is
    if (process.platform === 'darwin') {
        return new Promise<void>((resolve) => {
            cp.exec(
                'osascript -e \'tell application "System Events" to keystroke "v" using command down\'',
                (error, _stdout, stderr) => {
                    const output = stderr || '';
                    
                    // Check for any error (error object OR stderr contains error message)
                    if (error || output.includes('error') || output.includes('not allowed')) {
                        // Check for accessibility permission error
                        if (output.includes('not allowed') || 
                            output.includes('assistive access') || 
                            output.includes('1002')) {
                            vscode.window.showErrorMessage(
                                'Kiro Voice needs Accessibility permissions to auto-paste. ' +
                                'Enable Kiro in: System Settings → Privacy & Security → Accessibility. ' +
                                'Text is copied to clipboard - press Cmd+V to paste.',
                                'Open Settings'
                            ).then(selection => {
                                if (selection === 'Open Settings') {
                                    cp.exec('open x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
                                }
                            });
                        } else {
                            vscode.window.showWarningMessage(
                                `Auto-paste failed. Text copied to clipboard - press Cmd+V to paste.`
                            );
                        }
                        vscode.window.setStatusBarMessage('$(clippy) Press Cmd+V to paste', 5000);
                        resolve();
                        return;
                    }
                    
                    vscode.window.setStatusBarMessage('$(check) Pasted', 2000);
                    resolve();
                }
            );
        });
    }
    
    // Non-macOS fallback: Notify user to paste manually
    vscode.window.showInformationMessage(
        'Voice text copied to clipboard. Press Ctrl+V to paste.',
        'OK'
    );
    vscode.window.setStatusBarMessage('$(clippy) Press Ctrl+V to paste', 5000);
}

export function deactivate() {
    if (voiceProcess) voiceProcess.kill();
}