import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeStats } from './extension';

export async function exportStats(stats: CodeStats) {
    // 选择导出格式
    const format = await vscode.window.showQuickPick(['JSON', 'CSV', 'HTML'], {
        placeHolder: '选择导出格式'
    });

    if (!format) return;

    // 选择保存位置
    const uri = await vscode.window.showSaveDialog({
        filters: {
            [format]: [format.toLowerCase()]
        },
        defaultUri: vscode.Uri.file(`code-stats-${new Date().toISOString().slice(0,10)}.${format.toLowerCase()}`)
    });

    if (!uri) return;

    try {
        let content: string;
        switch(format) {
            case 'JSON':
                content = JSON.stringify(stats, null, 2);
                break;
            case 'CSV':
                content = generateCSV(stats);
                break;
            case 'HTML':
                content = generateHTML(stats);
                break;
            default:
                return;
        }

        await fs.promises.writeFile(uri.fsPath, content);
        vscode.window.showInformationMessage(`统计数据已导出为${format}格式`);
    } catch (err) {
        vscode.window.showErrorMessage(`导出失败: ${err}`);
    }
}

function generateCSV(stats: CodeStats): string {
    let csv = 'Metric,Value\n';
    csv += `Characters Typed,${stats.charsTyped}\n`;
    csv += `Characters Deleted,${stats.charsDeleted}\n`;
    csv += `Lines Changed,${stats.linesChanged}\n\n`;
    
    csv += 'Project,Path\n';
    stats.projects.forEach(p => {
        csv += `${p.name},${p.path}\n`;
    });

    csv += '\nSession Start,Session End\n';
    stats.codingSessions.forEach(s => {
        csv += `${s.start.toISOString()},${s.end.toISOString()}\n`;
    });

    return csv;
}

function generateHTML(stats: CodeStats): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Code Statistics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Code Statistics Report</h1>
    <h2>Summary</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Characters Typed</td><td>${stats.charsTyped}</td></tr>
        <tr><td>Characters Deleted</td><td>${stats.charsDeleted}</td></tr>
        <tr><td>Lines Changed</td><td>${stats.linesChanged}</td></tr>
    </table>

    <h2>Projects</h2>
    <table>
        <tr><th>Name</th><th>Path</th></tr>
        ${stats.projects.map(p => `<tr><td>${p.name}</td><td>${p.path}</td></tr>`).join('')}
    </table>

    <h2>Coding Sessions</h2>
    <table>
        <tr><th>Start Time</th><th>End Time</th><th>Duration</th></tr>
        ${stats.codingSessions.map(s => {
            const duration = (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000 / 60;
            return `<tr>
                <td>${s.start.toLocaleString()}</td>
                <td>${s.end.toLocaleString()}</td>
                <td>${duration.toFixed(1)} minutes</td>
            </tr>`;
        }).join('')}
    </table>
</body>
</html>`;
}
