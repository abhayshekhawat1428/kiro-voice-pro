// Handles Audio Recording Process
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

export class VoiceManager {
    static statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    private static engineProcess: ChildProcess | null = null;
    private static isRecording: boolean = false;

    static {
        this.statusBarItem.command = 'kiro.toggleVoice';
        this.statusBarItem.text = '$(mic) Voice';
        this.statusBarItem.show();
    }

    static toggle(enginePath: string): void {
        if (this.engineProcess) {
            this.stop();
        } else {
            this.start(enginePath);
        }
    }

    private static start(enginePath: string): void {
        if (this.isRecording) {
            vscode.window.showWarningMessage('Already recording!');
            return;
        }

        this.statusBarItem.text = '$(sync~spin) Init...';
        this.engineProcess = spawn(enginePath);
        this.isRecording = true;

        let capturedText = '';

        this.engineProcess.stdout?.on('data', (data) => {
            capturedText += data.toString();
        });

        this.engineProcess.stderr?.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes("READY_TO_RECORD")) {
                this.statusBarItem.text = '$(record) Listening...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else {
                console.error(`Voice Engine Error: ${msg}`);
            }
        });

        this.engineProcess.on('error', (error) => {
            console.error('Failed to start voice engine:', error);
            vscode.window.showErrorMessage('Failed to start recording');
            this.isRecording = false;
            this.statusBarItem.text = '$(mic) Voice';
            this.statusBarItem.backgroundColor = undefined;
        });

        this.engineProcess.on('close', (code) => {
            this.engineProcess = null;
            this.isRecording = false;
            
            if (code === 0 && capturedText.trim()) {
                this.insertText(capturedText.trim());
            }
            
            this.statusBarItem.text = '$(mic) Voice';
            this.statusBarItem.backgroundColor = undefined;
        });
    }

    static stop(): void {
        if (this.engineProcess) {
            this.engineProcess.stdin?.write("STOP\n");
        }
    }

    private static insertText(text: string): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(e => e.insert(editor.selection.active, text + " "));
        } else {
            vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage("Copied to clipboard!");
        }
    }
}
