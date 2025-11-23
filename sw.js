const cache_name = 'crypto-cache-v3';
const availible_offline = true;
const min_cache_mime = {
	"image": 86400,
	"text": 86400,
	"application/wasm": 86400,
	"application/javascript": 3600,
	'audio': -1
};
const max_cache_count = 10; // max entries per url path

const epochTime = (...args)=>Math.trunc(new Date(...args).getTime() / 1e3);
const responseTime = (response)=>Math.trunc(new Date(response.headers.get("Date")).getTime() / 1e3);
const SW_FUNCs = {	
	"SW_EPOCH": epochTime,
	"SW_RANDOM": ()=>String(self.crypto.getRandomValues(new Uint32Array(1))[0]),
	"SW_CACHE": ()=>cache_name
};

const activelyChanging = (()=>{
	const ac_url = "/ac.json";
	const ac_timeout = 180;
	let ac_last_updated = 0;
	let ac = [];
	
	async function updateAC(){
		if (navigator.onLine == false){
			ac_last_updated = epochTime();
			return true;
		}
		
		try {
			const acr = await fetch(ac_url, {cache: 'no-cache'});
			if (acr.ok){
				try{
					ac = await acr.json();
					for (let i = 0; i < ac.length; ++i){
						if (ac[i].length && ac[i][0] == '/'){
							ac[i] = location.origin + ac[i];
						}
					}
				}
				catch(e){
				}
			}
			else{
				if (Math.trunc(acr.status_code / 100) != 4){
					return false;
				}
			}
		} catch(e){}
		
		ac_last_updated = epochTime();
		return true;
	}	
	
	return function(url_path){
		if (url_path == -1){
			return updateAC();
		}
		const ct = epochTime();
		if (ct - ac_last_updated > ac_timeout){
			updateAC();
		}
		return ac.indexOf(url_path) > -1;
	};
})();


const forwardResponse = async function(response){
	const mtype = response.headers.get('content-type');
	if (mtype.startsWith("text") || mtype.endsWith("/javascript"))
	{
		const headers = new Headers(response.headers);
		headers.append('SW_Processed', cache_name);
		if (!headers.get("cache-control")){
			headers.append("Cache-control", "no-store");
		}
		
		let body_txt = await response.text();
		for (const swf in SW_FUNCs){
			if (body_txt.indexOf(swf) > -1){
				const nv = String(SW_FUNCs[swf]());
				body_txt = body_txt.replaceAll(swf, nv);
			}
		}
		
		return new Response(body_txt, {
			status: response.status,
			statusText: response.statusText,
			headers: headers
		});
	}
	return response;
};


self.addEventListener('activate', async (e) => {
	console.log('[Service Worker] Activate');
	const ckeys = await caches.keys();
	for (const ck of ckeys)
	{
		if (ck == cache_name){
			continue;
		}
		await caches.delete(ck);
	}
	activelyChanging(-1);
});

async function handleFetch(request, client_id = null){
	if (["GET", "HEAD"].indexOf(request.method) == -1){
		return fetch(request);
	}
	const ctime = epochTime();
	
	const ac = activelyChanging(request.url);
	const cache = await caches.open(cache_name);
	
	const r = await cache.match(request);	
	if (r){
		if (navigator.onLine == false && availible_offline){
			return forwardResponse(r);
		}
		
		if (!ac && !r.headers.get("cache-control") && !r.headers.get("vary")){
			const rtime = responseTime(r);
			const dtime = ctime - rtime;
			const mtype = r.headers.get('content-type');
			for (const k in min_cache_mime){
				if (mtype.startsWith(k)){
					if (dtime < min_cache_mime[k] || min_cache_mime[k] < 0){
						return forwardResponse(r);
					}
				}
			}
		}
		
	}
	
	try
	{
		const nr = await fetch(request, ac ? {cache: 'no-cache'} : {});
		switch(nr.type)
		{
			case 'basic':
			case 'cors':
				break;
			default:
				return nr;
		}
		
		if (!r){
			console.log('[Service Worker] Caching new resource:', request.url);
			
			if (new URL(request.url).search.length){
				if ((await cache.matchAll(request, {ignoreSearch: true})).length > max_cache_count){
					cache.delete(request, {ignoreSearch: true});
				}
			}
		}
		else{
			console.debug('[Service Worker] Caching updating resource:', request.url);
		}
		
		if (['audio', 'video'].indexOf(nr.headers.get('content-type').split('/')[0]) > -1){
			cache.add(request.url);
		}
		else{
			cache.put(request, nr.clone());
		}
		return forwardResponse(nr);
	}
	catch(e)
	{
		if (r){
			console.warn("fallback response");
			return forwardResponse(r);
		}
		else{
			console.error(e);
			if (client_id){
				const client = await clients.get(client_id);
				client.postMessage("failed to get resource");
			}
		}
	}
}


self.addEventListener('fetch', (e) => {	
	e.respondWith(handleFetch(e.request));
});

self.addEventListener('message', (e) => {
	const msg = e.data;
	activelyChanging(-1);
	// navigator.serviceWorker.controller.postMessage (client call)	
});
