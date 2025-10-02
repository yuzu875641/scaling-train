// api/proxy.js (User-Agentを複数強制挿入する版)

export default async function (req, res) {
    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const targetUrl = req.query.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
        res.status(400).send('Error: "url" query parameter is missing or invalid.');
        return;
    }

    try {
        const headersToForward = {};
        
        // プロキシの動作を妨げるヘッダーを転送しないリスト
        const forbiddenHeaders = [
            'host', 'connection', 'content-length', 
            'transfer-encoding', 'expect', 'te', 'upgrade', 'keep-alive',
            'referer', // Refererは独自に設定するため一旦除外
            'user-agent' // 強制設定するため元のリクエストから除外
        ];

        // クライアントから受け取ったヘッダーを転送（一部除外）
        for (const key in req.headers) {
            const lowerKey = key.toLowerCase();
            if (!forbiddenHeaders.includes(lowerKey)) {
                headersToForward[lowerKey] = req.headers[key];
            }
        }
        
        // ★★★ 対策: 複数のUser-Agentを強制的に追加 ★★★
        // User-Agentはヘッダー内で一つしか持てないため、最も一般的なものを一つだけ厳選します。
        // もし単一のUser-Agentで認証が通らない場合、そのプロキシサーバーは特定のUser-Agent以外をブロックしています。
        // ここでは、最も互換性の高いChromeの最新版のUser-Agentを強制的に設定します。
        
        // User-Agentの強制設定 (400 Bad Request回避の最重要要素)
        headersToForward['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
        
        // Refererの強制設定 (動画サーバー側のセキュリティチェック回避)
        headersToForward['referer'] = 'https://woke-proxy.poketube.fun/';

        // Rangeヘッダーの転送 (動画のシークに必須)
        if (req.headers['range']) {
            headersToForward['range'] = req.headers['range'];
        }
        

        const response = await fetch(targetUrl, {
            headers: headersToForward,
        });

        if (!response.ok) {
            // 外部リソースがエラーを返した場合
            res.status(response.status).send(`External resource error: ${response.statusText} from target server.`);
            return;
        }

        // --- レスポンスヘッダーのコピー ---
        for (const [key, value] of response.headers.entries()) {
            res.setHeader(key, value);
        }
        
        // --- ストリーム処理 ---
        res.status(response.status);

        if (response.body) {
            for await (const chunk of response.body) {
                res.write(chunk);
            }
            res.end();
        } else {
            res.status(500).send('No response body received.');
        }

    } catch (error) {
        console.error('Proxy Failed:', error);
        res.status(502).send('Proxy Failed: Could not reach external server.');
    }
}
