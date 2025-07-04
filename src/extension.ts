// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exportStats } from './export';

export interface CodeStats {
    charsTyped: number;
    charsDeleted: number;
    linesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    codingSessions: {start: Date, end: Date, language?: string}[];
    projects: {name: string, path: string}[];
    languages: {[key: string]: number}; // 语言 -> 总时长(毫秒)
    totalChars: number;
    totalLines: number;
    totalDuration: number;
}

export function activate(context: vscode.ExtensionContext) {
    const savedStats = context.globalState.get<CodeStats>('codeStats');
    // 恢复数据时确保日期对象正确转换
    const stats: CodeStats = savedStats ? {
        charsTyped: savedStats.charsTyped || 0,
        charsDeleted: savedStats.charsDeleted || 0,
        linesChanged: savedStats.linesChanged || 0,
        linesAdded: savedStats.linesAdded || 0,
        linesRemoved: savedStats.linesRemoved || 0,
        codingSessions: (savedStats.codingSessions || []).map(s => ({
            start: new Date(s.start),
            end: new Date(s.end),
            language: s.language
        })),
        projects: savedStats.projects || [],
        languages: savedStats.languages || {},
        totalChars: (savedStats.charsTyped || 0) + (savedStats.charsDeleted || 0),
        totalLines: (savedStats.linesAdded || 0) + (savedStats.linesRemoved || 0),
        totalDuration: (savedStats.codingSessions || []).reduce((sum, s) => 
            sum + (new Date(s.end).getTime() - new Date(s.start).getTime()), 0)
    } : {
        charsTyped: 0,
        charsDeleted: 0,
        linesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
        codingSessions: [],
        projects: [],
        languages: {},
        totalChars: 0,
        totalLines: 0,
        totalDuration: 0
    };

    async function saveStats() {
        // 深拷贝stats对象避免引用问题
        const statsToSave = {
            charsTyped: stats.charsTyped,
            charsDeleted: stats.charsDeleted,
            linesChanged: stats.linesChanged,
            linesAdded: stats.linesAdded,
            linesRemoved: stats.linesRemoved,
            codingSessions: stats.codingSessions.map(s => ({
                start: new Date(s.start),
                end: new Date(s.end),
                language: s.language
            })),
            projects: [...stats.projects],
            languages: {...stats.languages},
            totalChars: stats.totalChars,
            totalLines: stats.totalLines,
            totalDuration: stats.totalDuration
        };
        await context.globalState.update('codeStats', statsToSave);
    }

    // Auto-save every 1 minute
    const saveInterval = setInterval(saveStats, 60 * 1000);
    
    // 窗口关闭时立即保存
    vscode.window.onDidCloseTerminal(saveStats);

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

    function recordActivity(e?: vscode.TextDocumentChangeEvent) {
        const now = new Date();
        clearTimeout(sessionTimeout);

        // 获取当前文件语言
        let language = '';
        if (e) {
            language = e.document.languageId;
        }

        if (!stats.codingSessions.length || 
            now.getTime() - lastChangeTime.getTime() > 5*60*1000) {
            stats.codingSessions.push({
                start: now,
                end: now,
                language
            });
        } else {
            const lastSession = stats.codingSessions[stats.codingSessions.length-1];
            lastSession.end = now;
            lastSession.language = language || lastSession.language;
        }

        // 更新语言统计
        if (language) {
            const duration = now.getTime() - lastChangeTime.getTime();
            stats.languages[language] = (stats.languages[language] || 0) + duration;
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
            if (change.text.includes('\n')) {
                const addedLines = change.text.split('\n').length - 1;
                stats.linesAdded += addedLines;
                stats.linesChanged += addedLines;
            }
            if (change.rangeLength > 0) {
                const removedLines = e.document.getText(change.range).split('\n').length - 1;
                stats.linesRemoved += removedLines;
                stats.linesChanged += removedLines;
            }
            recordActivity();
            updateStats();
        });
    });

    trackProject();
    vscode.workspace.onDidChangeWorkspaceFolders(trackProject);

    // 监听窗口状态变化
    vscode.window.onDidChangeWindowState(e => {
        if (!e.focused) {
            clearTimeout(sessionTimeout);
            if (stats.codingSessions.length > 0) {
                const lastSession = stats.codingSessions[stats.codingSessions.length-1];
                lastSession.end = new Date();
            }
        }
    });

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

        const totalHours = Math.floor(stats.totalDuration / 1000 / 60 / 60);
    const totalMinutes = Math.floor((stats.totalDuration / 1000 / 60) % 60);
    
    vscode.window.showInformationMessage(
            `Code Statistics:\n` +
            `Total Duration: ${totalHours}h ${totalMinutes}m\n` +
            `Total Characters: ${stats.totalChars}\n` +
            `Total Lines: ${stats.totalLines}\n\n` +
            `Details:\n` +
            `Characters Typed: ${stats.charsTyped}\n` +
            `Characters Deleted: ${stats.charsDeleted}\n` +
            `Lines Changed: ${stats.linesChanged}\n` +
            `Lines Added: ${stats.linesAdded}\n` +
            `Lines Removed: ${stats.linesRemoved}\n\n` +
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
