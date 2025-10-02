// api/proxy.js

// Vercel/Node.js環境で動作するサーバーレス関数
export default async function (req, res) {
    // GETメソッドのチェック
    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // クエリパラメータからプロキシ先のURLを取得
    const targetUrl = req.query.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
        res.status(400).send('Error: "url" query parameter is missing or invalid.');
        return;
    }

    try {
        // 外部URLにリクエストを送信
        // Node.jsの標準fetchはリダイレクトを自動で追跡します
        const response = await fetch(targetUrl);

        if (!response.ok) {
            // 外部リソースがエラーを返した場合
            res.status(response.status).send(`External resource error: ${response.statusText}`);
            return;
        }

        // --- ヘッダーのコピー ---
        // 動画ストリームに必要なヘッダーを外部レスポンスからコピー
        const headersToCopy = [
            'content-type', 
            'content-length', 
            'accept-ranges', 
            'cache-control',
            // 他に必要なヘッダーがあれば追加
        ];

        headersToCopy.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                res.setHeader(header, value);
            }
        });

        // --- ストリーム処理 ---
        // ステータスコードを設定
        res.status(response.status);

        // 応答ストリームをクライアントに書き込む
        if (response.body) {
            // response.bodyはNode.jsのReadableStream
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
