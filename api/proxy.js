// api/proxy.js (最終修正版)

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
        
        // プロキシの動作を妨げる、または不正な値になるヘッダーをリスト化
        const forbiddenHeaders = [
            'host', 'connection', 'content-length', 
            'transfer-encoding', 'expect', 'te', 'upgrade', 'keep-alive',
            'referer' // Refererは独自に設定するため一旦除外
        ];

        // クライアントから受け取ったヘッダーをすべて転送
        for (const key in req.headers) {
            const lowerKey = key.toLowerCase();
            if (!forbiddenHeaders.includes(lowerKey)) {
                headersToForward[lowerKey] = req.headers[key];
            }
        }
        
        // ★★★ 必須の追加対策: Refererヘッダーを設定 ★★★
        // 外部サーバーは、自分自身のドメインからのリクエストであると期待する可能性がある
        // 外部サービスのベースURLを設定することで、リファラーチェックを回避
        headersToForward['referer'] = 'https://woke-proxy.poketube.fun/';
        // Rangeヘッダーは動画のシークに必須
        if (req.headers['range']) {
            headersToForward['range'] = req.headers['range'];
        }
        

        const response = await fetch(targetUrl, {
            headers: headersToForward,
        });

        if (!response.ok) {
            res.status(response.status).send(`External resource error: ${response.statusText} from target server.`);
            return;
        }

        // --- レスポンスヘッダーのコピー ---
        for (const [key, value] of response.headers.entries()) {
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
