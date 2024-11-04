const offers = new Map<string, {sd: RTCSessionDescriptionInit, res: (value: Response | PromiseLike<Response>) => void, timer: Timer}>();

const badRequest = new Response("Bad Request", {status: 400});
const notFound = new Response("Not Found", {status: 404});
const requestTimeout = new Response("Request Timeout", {status: 408});

Bun.serve({
    port: process.env.PORT,
    async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/create-offer") {
            if (req.method !== 'POST') return badRequest;

            const body = await req.json();
            if (!body.id || !body.sd) return badRequest;

            return new Promise<Response>((resolve) => {
                const timeout = setTimeout(() => {
                    offers.delete(body.id);
                    resolve(requestTimeout);
                }, 60000);
                offers.set(body.id, {sd: body.sd, res: resolve, timer: timeout});
            });
        }

        if (url.pathname === "/get-offer") {
            if (req.method !== 'GET') return badRequest;

            const id = url.searchParams.get('id');
            if (!id) return badRequest;

            const waitingOffer = offers.get(id);

            if (waitingOffer) return new Response(JSON.stringify(waitingOffer.sd));
            else return notFound;
        }

        if (url.pathname === "/create-answer") {
            if (req.method !== 'POST') return badRequest;

            const body = await req.json();
            if (!body.id || !body.sd) return badRequest;

            const waitingOffer = offers.get(body.id);
            
            if (waitingOffer) {
                clearTimeout(waitingOffer.timer);
                waitingOffer.res(new Response(JSON.stringify(body.sd)));
                offers.delete(body.id);
                return new Response("Wait for connecting");
            }
            else return notFound;
        }

        return badRequest;
    }
});