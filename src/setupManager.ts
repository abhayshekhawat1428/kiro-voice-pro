import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export class SetupManager {
    static async checkAndSetup(context: vscode.ExtensionContext): Promise<boolean> {
        // 1. Check Voice Engine Binary (Download if missing)
        const engineReady = await this.ensureVoiceEngine(context);
        if (!engineReady) return false;

        // 2. Check Ollama (Install if missing)
        const ollamaInstalled = await this.ensureOllama();
        if (!ollamaInstalled) return false;

        // 3. Check Model (Pull if missing)
        const config = vscode.workspace.getConfiguration('kiroVoice');
        const model = config.get<string>('modelName') || 'mistral';
        await this.ensureModel(model);

        return true;
    }

    // --- OLLAMA LOGIC ---
    private static async ensureOllama(): Promise<boolean> {
        try {
            cp.execSync('ollama --version', { stdio: 'ignore' });
            return true;
        } catch {
            const choice = await vscode.window.showWarningMessage(
                "Ollama is required for AI text cleanup. Install now?",
                "Install Ollama", "Skip AI Cleanup"
            );

            if (choice === "Skip AI Cleanup") {
                // Allow using extension without AI cleanup
                return true;
            }

            if (choice === "Install Ollama") {
                return await this.installOllama();
            }
            return false;
        }
    }

    private static async installOllama(): Promise<boolean> {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Installing Ollama...",
            cancellable: false
        }, async (progress) => {
            return new Promise<boolean>((resolve) => {
                if (process.platform === 'win32') {
                    // Windows: Download and run installer
                    vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download/windows"));
                    vscode.window.showInformationMessage(
                        "Please complete the Ollama installer, then click 'Done'.",
                        "Done"
                    ).then(() => resolve(true));
                } else if (process.platform === 'darwin') {
                    // macOS: Use brew or curl
                    progress.report({ message: "Downloading..." });
                    const installProcess = cp.spawn('bash', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    
                    installProcess.on('close', (code) => {
                        if (code === 0) {
                            // Start Ollama service
                            cp.exec('ollama serve &');
                            vscode.window.showInformationMessage("Ollama installed successfully!");
                            resolve(true);
                        } else {
                            vscode.window.showErrorMessage(
                                "Ollama installation failed. Please install manually from ollama.com"
                            );
                            vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download"));
                            resolve(false);
                        }
                    });
                } else {
                    // Linux: Use curl installer
                    progress.report({ message: "Downloading..." });
                    const installProcess = cp.spawn('bash', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    
                    installProcess.on('close', (code) => {
                        if (code === 0) {
                            vscode.window.showInformationMessage("Ollama installed successfully!");
                            resolve(true);
                        } else {
                            vscode.window.showErrorMessage(
                                "Ollama installation failed. Please install manually from ollama.com"
                            );
                            resolve(false);
                        }
                    });
                }
            });
        });
    }

    // --- MODEL LOGIC ---
    private static async ensureModel(modelName: string): Promise<boolean> {
        return new Promise((resolve) => {
            cp.exec('ollama list', (err, stdout) => {
                if (!err && stdout.includes(modelName)) {
                    resolve(true); // Model exists
                    return;
                }

                // Model missing: Pull it automatically
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Downloading AI model (${modelName})...`,
                    cancellable: true
                }, async (progress, token) => {
                    return new Promise<void>((resolveProgress) => {
                        const pullProcess = cp.spawn('ollama', ['pull', modelName]);
                        
                        let lastProgress = '';
                        pullProcess.stderr.on('data', (data) => {
                            const msg = data.toString();
                            // Parse progress percentage if available
                            const match = msg.match(/(\d+)%/);
                            if (match && match[1] !== lastProgress) {
                                lastProgress = match[1];
                                progress.report({ message: `${lastProgress}% complete` });
                            }
                        });

                        token.onCancellationRequested(() => {
                            pullProcess.kill();
                            resolve(false);
                            resolveProgress();
                        });

                        pullProcess.on('close', (code) => {
                            if (code === 0) {
                                vscode.window.showInformationMessage(`Model ${modelName} ready!`);
                                resolve(true);
                            } else {
                                vscode.window.showWarningMessage(
                                    `Failed to download model. AI cleanup will be skipped.`
                                );
                                resolve(false);
                            }
                            resolveProgress();
                        });

                        pullProcess.on('error', () => {
                            resolve(false);
                            resolveProgress();
                        });
                    });
                });
            });
        });
    }

    // --- VOICE ENGINE DOWNLOADER ---
    private static GITHUB_USER = "abhayshekhawat1428";
    private static GITHUB_REPO = "kiro-voice-pro";
    private static VERSION = "v1.0.0";

    static async ensureVoiceEngine(context: vscode.ExtensionContext): Promise<boolean> {
        const storagePath = context.globalStorageUri.fsPath;
        let filename = 'kiro_voice_engine_linux';
        if (process.platform === 'win32') filename = 'kiro_voice_engine_win.exe';
        if (process.platform === 'darwin') filename = 'kiro_voice_engine_macos';

        const finalPath = path.join(storagePath, filename);
        
        // Check if file exists AND is executable (not empty/corrupted)
        if (fs.existsSync(finalPath)) {
            const stats = fs.statSync(finalPath);
            // If file is too small (< 1KB), it's probably corrupted - delete and re-download
            if (stats.size < 1024) {
                fs.unlinkSync(finalPath);
            } else {
                // Ensure it has execute permissions on Unix
                if (process.platform !== 'win32') {
                    try {
                        fs.chmodSync(finalPath, 0o755);
                        // macOS: Remove quarantine attribute to bypass Gatekeeper
                        if (process.platform === 'darwin') {
                            cp.exec(`xattr -d com.apple.quarantine "${finalPath}"`, () => {});
                        }
                    } catch {
                        // Ignore chmod errors
                    }
                }
                return true;
            }
        }

        // If missing, download automatically
        if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
        
        const url = `https://github.com/${this.GITHUB_USER}/${this.GITHUB_REPO}/releases/download/${this.VERSION}/${filename}`;
        
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Downloading Voice Engine...",
            cancellable: false
        }, async () => {
            return new Promise<boolean>((resolve) => {
                const downloadFile = (downloadUrl: string, redirectCount = 0) => {
                    if (redirectCount > 5) {
                        vscode.window.showErrorMessage('Too many redirects while downloading voice engine.');
                        resolve(false);
                        return;
                    }

                    const protocol = downloadUrl.startsWith('https') ? https : require('http');
                    
                    protocol.get(downloadUrl, (res: any) => {
                        // Handle redirects (GitHub uses 302)
                        if (res.statusCode === 301 || res.statusCode === 302) {
                            const redirectUrl = res.headers.location;
                            if (redirectUrl) {
                                downloadFile(redirectUrl, redirectCount + 1);
                                return;
                            }
                        }

                        if (res.statusCode !== 200) {
                            vscode.window.showErrorMessage(
                                `Voice engine not available (HTTP ${res.statusCode}). ` +
                                'Enable "Use Local Python" in settings for development mode.'
                            );
                            resolve(false);
                            return;
                        }

                        const file = fs.createWriteStream(finalPath);
                        res.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            if (process.platform !== 'win32') {
                                try {
                                    fs.chmodSync(finalPath, 0o755);
                                    // macOS: Remove quarantine attribute to bypass Gatekeeper
                                    if (process.platform === 'darwin') {
                                        cp.exec(`xattr -d com.apple.quarantine "${finalPath}"`, () => {});
                                    }
                                } catch (e) {
                                    console.error('Failed to set execute permission:', e);
                                }
                            }
                            vscode.window.showInformationMessage('Voice engine downloaded successfully!');
                            resolve(true);
                        });
                        file.on('error', (err: Error) => {
                            fs.unlink(finalPath, () => {});
                            vscode.window.showErrorMessage(`Download failed: ${err.message}`);
                            resolve(false);
                        });
                    }).on('error', (err: Error) => {
                        vscode.window.showErrorMessage(`Download failed: ${err.message}`);
                        resolve(false);
                    });
                };

                downloadFile(url);
            });
        });
    }

    static getEnginePath(context: vscode.ExtensionContext): string {
        const storagePath = context.globalStorageUri.fsPath;
        if (process.platform === 'win32') return path.join(storagePath, 'kiro_voice_engine_win.exe');
        if (process.platform === 'darwin') return path.join(storagePath, 'kiro_voice_engine_macos');
        return path.join(storagePath, 'kiro_voice_engine_linux');
    }
}