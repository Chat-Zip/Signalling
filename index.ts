const offers = new Map<string, { sd: RTCSessionDescriptionInit, res: (value: Response | PromiseLike<Response>) => void, timer: Timer }>();

function applyCORSHeader(res: Response) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return res;
}
function response(content: string, code: number) {
    const response = new Response(content, { status: code });
    return applyCORSHeader(response);
}

Bun.serve({
    port: process.env.PORT,
    async fetch(req) {
        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            return response('Departed', 200);
        }

        const url = new URL(req.url);

        if (url.pathname === "/create-offer") {
            if (req.method !== 'POST') return response("Bad Request", 400);

            const body = await req.json();
            if (!body.id || !body.sd) return response("Bad Request", 400);
            if (offers.has(body.id)) return response("ID Already Exists", 202)

            return new Promise<Response>((resolve) => {
                const timeout = setTimeout(() => {
                    offers.delete(body.id);
                    const timeoutRes = response(`Code (${body.id}) is inactive (timeout)`, 408);
                    resolve(timeoutRes);
                }, 30000);
                offers.set(body.id, { sd: body.sd, res: resolve, timer: timeout });
            });
        }

        if (url.pathname === "/delete-offer") {
            if (req.method !== 'GET') return response("Bad Request", 400);

            const id = url.searchParams.get('id');
            if (!id) return response("Bad Request", 400);
            if (!offers.has(id)) return response("Not Found", 404);

            const waitingOffer = offers.get(id);
            clearTimeout(waitingOffer!.timer);
            const resOffer = response("", 204); // No contents
            waitingOffer!.res(resOffer);
            offers.delete(id);

            return response(`Code (${id}) is inactive (deleted)`, 200);
        }

        if (url.pathname === "/get-offer") {
            if (req.method !== 'GET') return response("Bad Request", 400);

            const id = url.searchParams.get('id');
            if (!id) return response("Bad Request", 400);

            const waitingOffer = offers.get(id);

            if (waitingOffer) return response(JSON.stringify(waitingOffer.sd), 200);
            else return response("Not Found", 404);
        }

        if (url.pathname === "/create-answer") {
            if (req.method !== 'POST') return response("Bad Request", 400);

            const body = await req.json();
            if (!body.id || !body.sd) return response("Bad Request", 400);

            const waitingOffer = offers.get(body.id);

            if (waitingOffer) {
                clearTimeout(waitingOffer.timer);
                const resOffer = response(JSON.stringify(body.sd), 200)
                waitingOffer.res(resOffer);
                offers.delete(body.id);
                return response("Wait for connecting", 200);
            }
            else return response("Not Found", 404);
        }

        return response("Bad Request", 400);
    }
});