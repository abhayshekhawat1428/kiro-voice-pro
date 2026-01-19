import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as https from 'https';
import * as http from 'http';

interface LLMConfig {
    provider: string;
    model: string;
    endpoint: string;
    apiKey: string;
}

export async function processTextWithAI(rawText: string): Promise<string> {
    const config = getConfiguration();

    // 1. If provider is Ollama, ensure it's ready
    if (config.provider === 'ollama') {
        const ready = await ensureOllamaReady(config.model);
        if (!ready) return rawText; // Fallback to raw text if setup fails
    }

    // 2. Send Request
    return await sendLLMRequest(rawText, config);
}

function getConfiguration(): LLMConfig {
    const cfg = vscode.workspace.getConfiguration('kiroVoice');
    return {
        provider: cfg.get<string>('aiProvider') || 'ollama',
        model: cfg.get<string>('modelName') || 'mistral',
        endpoint: cfg.get<string>('apiEndpoint') || 'http://localhost:11434/v1/chat/completions',
        apiKey: cfg.get<string>('apiKey') || ''
    };
}

// --- OLLAMA MANAGEMENT LOGIC ---

async function ensureOllamaReady(modelName: string): Promise<boolean> {
    // Step A: Check if Ollama is installed
    if (!isOllamaInstalled()) {
        const choice = await vscode.window.showErrorMessage(
            "Ollama is not installed. Kiro needs it to clean your voice input locally.",
            "Install Ollama", "Disable Optimization"
        );
        if (choice === "Install Ollama") {
            vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download"));
        }
        return false;
    }

    // Step B: Check if Model exists
    if (!await isModelAvailable(modelName)) {
        const choice = await vscode.window.showInformationMessage(
            `Model '${modelName}' is missing. Download it now? (~4GB)`,
            "Download", "Cancel"
        );
        
        if (choice === "Download") {
            return await pullModel(modelName);
        }
        return false;
    }

    return true;
}

function isOllamaInstalled(): boolean {
    try {
        cp.execSync('ollama --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

async function isModelAvailable(modelName: string): Promise<boolean> {
    return new Promise((resolve) => {
        cp.exec('ollama list', (err, stdout) => {
            if (err) resolve(false);
            if (stdout.includes(modelName)) resolve(true);
            else resolve(false);
        });
    });
}

async function pullModel(modelName: string): Promise<boolean> {
    return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading ${modelName}... (This may take a while)`,
        cancellable: true
    }, async (progress, token) => {
        return new Promise<boolean>((resolve) => {
            const process = cp.spawn('ollama', ['pull', modelName]);

            process.stderr.on('data', (data) => {
                // Parse progress from Ollama output if possible
                progress.report({ message: data.toString() });
            });

            token.onCancellationRequested(() => {
                process.kill();
                resolve(false);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    vscode.window.showInformationMessage("Model ready!");
                    resolve(true);
                } else {
                    vscode.window.showErrorMessage("Failed to download model.");
                    resolve(false);
                }
            });
        });
    });
}

// --- API REQUEST LOGIC (Universal for Ollama/OpenAI) ---

async function sendLLMRequest(text: string, config: LLMConfig): Promise<string> {
   // --- THE FIX: STRICT "ECHO" PROMPT ---
    const systemPrompt = `
    You are a text optimization tool. You are NOT an AI assistant.
    
    Your ONLY goal is to rewrite the user's voice input into a clear, concise prompt.
    
    STRICT RULES:
    1. Do NOT answer the question.
    2. Do NOT write any code.
    3. Do NOT provide explanations.
    4. Do NOT use conversational filler ("Sure", "Here is").
    5. If the user asks for code, REWRITE the request as a clear instruction.
    
    EXAMPLE:
    Input: "Um, can you write a python script to like, scan ports?"
    Output: Write a Python script to scan network ports.
    
    Input: "Help me sleep for 10 seconds in Java."
    Output: Write Java code to sleep for 10 seconds.
    `;

    const payload = JSON.stringify({
        model: config.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
        ],
        temperature: 0.1 // Keep it boring and literal
    });

    // Handle Endpoint parsing
    const url = new URL(config.endpoint);
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
        const req = transport.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    // Support standard OpenAI format (which Ollama mimics)
                    const result = json.choices?.[0]?.message?.content?.trim();
                    resolve(result || text);
                } catch {
                    resolve(text);
                }
            });
        });

        req.on('error', (e) => {
            console.error(e);
            resolve(text); // Fail safe
        });

        req.write(payload);
        req.end();
    });
}