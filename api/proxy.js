// api/proxy.js

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
        // クライアントのリクエストヘッダーから、プロキシ先に渡すヘッダーを構築
        const headersToForward = {};
        
        // 転送すべきでないヘッダーのリスト（プロキシの動作を妨げるもの）
        const forbiddenHeaders = [
            'host', 
            'connection', 
            'content-length', 
            'transfer-encoding',
            'expect',
            'te',
            'upgrade',
            'keep-alive'
        ];

        // クライアントから受け取った全てのヘッダーを処理
        for (const key in req.headers) {
            const lowerKey = key.toLowerCase();
            if (!forbiddenHeaders.includes(lowerKey)) {
                // User-Agentを含む、許可されたヘッダーを全て転送
                headersToForward[lowerKey] = req.headers[key];
            }
        }
        
        // **Rangeヘッダーは動画のシークに不可欠なので、確実に含めます**
        if (req.headers['range']) {
            headersToForward['range'] = req.headers['range'];
        }
        

        // 外部URLにリクエストを送信
        const response = await fetch(targetUrl, {
            headers: headersToForward,
        });

        if (!response.ok) {
            // 外部リソースがエラーを返した場合
            res.status(response.status).send(`External resource error: ${response.statusText} from target server.`);
            return;
        }

        // --- ヘッダーのコピー (外部レスポンス -> クライアント) ---
        // 外部サーバーからのレスポンスヘッダーをクライアントに全てコピー
        for (const [key, value] of response.headers.entries()) {
            // transfer-encodingなど、Node/Vercelが自動で扱うべきヘッダーは除外
            if (!forbiddenHeaders.includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
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
