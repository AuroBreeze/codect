import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeStats } from './extension';

export async function exportStats(stats: CodeStats) {
    // 选择导出格式
    const format = await vscode.window.showQuickPick(['JSON', 'CSV', 'HTML'], {
        placeHolder: '选择导出格式'
    });

    if (!format) {return;}

    // 选择保存位置
    const uri = await vscode.window.showSaveDialog({
        filters: {
            [format]: [format.toLowerCase()]
        },
        defaultUri: vscode.Uri.file(`code-stats-${new Date().toISOString().slice(0,10)}.${format.toLowerCase()}`)
    });

    if (!uri) {return;}

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

        await fs.promises.writeFile(uri.fsPath, content, { encoding: 'utf8' });
        vscode.window.showInformationMessage(`统计数据已导出为${format}格式`);
    } catch (err) {
        vscode.window.showErrorMessage(`导出失败: ${err}`);
    }
}

function generateCSV(stats: CodeStats): string {
    let csv = 'Metric,Value\n';
    csv += `Total Duration (minutes),${Math.floor(stats.totalDuration/1000/60)}\n`;
    csv += `Total Characters,${stats.totalChars}\n`;
    csv += `Total Lines,${stats.totalLines}\n\n`;
    csv += `Characters Typed,${stats.charsTyped}\n`;
    csv += `Characters Deleted,${stats.charsDeleted}\n`;
    csv += `Lines Changed,${stats.linesChanged}\n`;
    csv += `Lines Added,${stats.linesAdded}\n`;
    csv += `Lines Removed,${stats.linesRemoved}\n\n`;
    
    csv += 'Project,Path\n';
    stats.projects.forEach(p => {
        csv += `${p.name},${p.path}\n`;
    });

    csv += '\nSession Start,Session End\n';
    stats.codingSessions.forEach(s => {
        csv += `${s.start.toISOString()},${s.end.toISOString()}\n`;
    });

    // 添加UTF-8 BOM头确保Excel正确识别编码
    return '\uFEFF' + csv;
}

function generateHTML(stats: CodeStats): string {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 分离最近7天和更早的会话
    const recentSessions = stats.codingSessions.filter(s => 
        new Date(s.start) >= sevenDaysAgo
    );
    const olderSessions = stats.codingSessions.filter(s => 
        new Date(s.start) < sevenDaysAgo
    );
    
    // 计算更早会话的总持续时间(分钟)
    const olderDuration = olderSessions.reduce((sum, s) => 
        sum + (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000 / 60, 0
    );

    return `<!DOCTYPE html>
<html>
<head>
    <title>Code Statistics Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-top: 0;
        }
        h2 {
            color: #3498db;
            margin-top: 30px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px 15px;
            text-align: left;
        }
        th {
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        tr:hover {
            background-color: #e6f7ff;
        }
        .total-row {
            font-weight: bold;
            background-color: #e6f7ff !important;
        }
    </style>
</head>
<body>
    <div class="container">
    <h1>Code Statistics Report</h1>
    <h2>Summary</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><th colspan="2">Summary</th></tr>
        <tr><td>Total Duration</td><td>${Math.floor(stats.totalDuration/1000/60/60)}h ${Math.floor((stats.totalDuration/1000/60)%60)}m</td></tr>
        <tr><td>Total Characters</td><td>${stats.totalChars}</td></tr>
        <tr><td>Total Lines</td><td>${stats.totalLines}</td></tr>
        <tr><th colspan="2">Details</th></tr>
        <tr><td>Characters Typed</td><td>${stats.charsTyped}</td></tr>
        <tr><td>Characters Deleted</td><td>${stats.charsDeleted}</td></tr>
        <tr><td>Lines Changed</td><td>${stats.linesChanged}</td></tr>
        <tr><td>Lines Added</td><td>${stats.linesAdded}</td></tr>
        <tr><td>Lines Removed</td><td>${stats.linesRemoved}</td></tr>
    </table>

    <h2>Projects</h2>
    <table>
        <tr><th>Name</th><th>Path</th></tr>
        ${stats.projects.map(p => `<tr><td>${p.name}</td><td>${p.path}</td></tr>`).join('')}
    </table>

    <h2>Language Statistics</h2>
    <table>
        <tr><th>Language</th><th>Total Duration</th></tr>
        ${Object.entries(stats.languages).map(([lang, duration]) => {
            const hours = Math.floor(duration / 1000 / 60 / 60);
            const minutes = Math.floor((duration / 1000 / 60) % 60);
            return `<tr>
                <td>${lang}</td>
                <td>${hours}h ${minutes}m</td>
            </tr>`;
        }).join('')}
    </table>

    <h2>Recent Coding Sessions (Last 7 Days)</h2>
    <table>
        <tr><th>Start Time</th><th>End Time</th><th>Duration</th></tr>
        ${recentSessions.map(s => {
            const duration = (new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000 / 60;
            return `<tr>
                <td>${s.start.toLocaleString()}</td>
                <td>${s.end.toLocaleString()}</td>
                <td>${duration.toFixed(1)} minutes</td>
            </tr>`;
        }).join('')}
    </table>

    ${olderSessions.length > 0 ? `
    <h2>Older Sessions (Before Last 7 Days)</h2>
    <table>
        <tr><th>Total Sessions</th><th>Total Duration</th></tr>
        <tr>
            <td>${olderSessions.length}</td>
            <td>${Math.floor(olderDuration/60)}h ${Math.floor(olderDuration%60)}m</td>
        </tr>
    </table>
    ` : ''}
    </div>
</body>
</html>`;
}
