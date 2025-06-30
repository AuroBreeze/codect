// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exportStats } from './export';

export interface CodeStats {
    charsTyped: number;
    charsDeleted: number;
    linesChanged: number;
    codingSessions: {start: Date, end: Date}[];
    projects: {name: string, path: string}[];
}

export function activate(context: vscode.ExtensionContext) {
    const savedStats = context.globalState.get<CodeStats>('codeStats');
    const stats: CodeStats = savedStats || {
        charsTyped: 0,
        charsDeleted: 0,
        linesChanged: 0,
        codingSessions: [],
        projects: []
    };

    async function saveStats() {
        await context.globalState.update('codeStats', stats);
    }

    // Auto-save every 5 minutes
    const saveInterval = setInterval(saveStats, 5 * 60 * 1000);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = `CodeCT: 0 chars`;
    statusBarItem.show();

    function updateStats() {
        statusBarItem.text = `CodeCT: ${stats.charsTyped} chars (+${stats.charsDeleted} del)`;
    }

    function trackProject() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (workspace) {
            const existing = stats.projects.find(p => p.path === workspace.uri.fsPath);
            if (!existing) {
                stats.projects.push({
                    name: workspace.name,
                    path: workspace.uri.fsPath
                });
            }
        }
    }

    let lastChangeTime = new Date();
    let sessionTimeout: NodeJS.Timeout;

    function recordActivity() {
        const now = new Date();
        clearTimeout(sessionTimeout);

        if (!stats.codingSessions.length || 
            now.getTime() - lastChangeTime.getTime() > 5*60*1000) {
            stats.codingSessions.push({
                start: now,
                end: now
            });
        } else {
            const lastSession = stats.codingSessions[stats.codingSessions.length-1];
            lastSession.end = now;
        }

        lastChangeTime = now;
        sessionTimeout = setTimeout(() => {
            updateStats();
        }, 1000);
    }

    vscode.workspace.onDidChangeTextDocument(e => {
        e.contentChanges.forEach(change => {
            stats.charsTyped += change.text.length;
            stats.charsDeleted += change.rangeLength;
            if (change.text.includes('\n') || change.rangeLength > 0) {
                stats.linesChanged++;
            }
            recordActivity();
            updateStats();
        });
    });

    trackProject();
    vscode.workspace.onDidChangeWorkspaceFolders(trackProject);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "codect" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('codect.showStats', () => {
        const projectList = stats.projects.map(p => `• ${p.name} (${p.path})`).join('\n');
        const sessionTimes = stats.codingSessions.map(s => 
            `• ${s.start.toLocaleTimeString()} - ${s.end.toLocaleTimeString()}`
        ).join('\n');

        vscode.window.showInformationMessage(
            `Code Statistics:\n` +
            `Characters Typed: ${stats.charsTyped}\n` +
            `Characters Deleted: ${stats.charsDeleted}\n` +
            `Lines Changed: ${stats.linesChanged}\n\n` +
            `Projects:\n${projectList}\n\n` +
            `Coding Sessions:\n${sessionTimes}`
        );
    });

    const exportDisposable = vscode.commands.registerCommand('codect.exportStats', () => {
        exportStats(stats);
    });

    context.subscriptions.push(
        disposable,
        exportDisposable,
        statusBarItem,
        new vscode.Disposable(() => {
            clearTimeout(sessionTimeout);
            clearInterval(saveInterval);
            saveStats();
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}
