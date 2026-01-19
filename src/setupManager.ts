import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export class SetupManager {
    static async checkAndSetup(context: vscode.ExtensionContext): Promise<boolean> {
        // Check Voice Engine Binary (Download if missing)
        return await this.ensureVoiceEngine(context);
    }

    // --- VOICE ENGINE DOWNLOADER ---
    // UPDATE THESE before publishing!
    private static GITHUB_USER = "abhayshekhawat1428";  // GitHub username
    private static GITHUB_REPO = "kiro-voice-pro";
    private static VERSION = "v1.0.0";  // Must match your GitHub release tag 

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