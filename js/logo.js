function DynamicLogo(parentNode)
{
    // Background
    var canvasDrawing = {
        color: 'blue',
        progress:0,
        duration: 2e3,
        init_time: performance.now()
    };


    const canvas = parentNode.appendChild(document.createElement("canvas"));
    canvas.style.left = '0px';
    canvas.style.right = '0px';
    canvas.style.height = '100%';
    canvas.style.width = '100%';

    const ctx = canvas.getContext('2d');



    var drawInterval = 0;
    const drawCtx = function(){
        canvasDrawing.progress = Math.min(1, (performance.now() - canvasDrawing.init_time) / canvasDrawing.duration);
        if (canvasDrawing.progress >= 1){
            return;
        }

        canvas.height = canvas.clientHeight;
        canvas.width = canvas.clientWidth;

		const cir = Math.min(canvas.height, canvas.width) / 2.2;
		const m_x = canvas.width / 2;
		const m_y = canvas.height / 2;

		ctx.clearRect(0,0,canvas.height, canvas.width);
		ctx.lineWidth = Math.trunc(cir * 0.1);
        ctx.strokeStyle = canvasDrawing.color;
		ctx.fillStyle = canvasDrawing.color;

        const fp = Math.min(1, canvasDrawing.progress / 0.50);
        ctx.beginPath();
		ctx.arc(m_x, m_y, cir, 0, fp*Math.PI);
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(m_x, m_y, cir, Math.PI, (1 + fp) * Math.PI);
		ctx.stroke();

        if (canvasDrawing.progress > 0.50)
        {
			const sp = Math.min(1, canvasDrawing.progress * 2 - 1);
			ctx.font = Math.trunc(cir) + 'px system-ui';
            ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';

			ctx.fillText("RB", m_x, m_y);

			if (sp < 1){
				ctx.globalCompositeOperation = 'destination-out';
				ctx.beginPath();
				ctx.arc(m_x, m_y, (cir - ctx.lineWidth / 2) * (1 - sp),  0, 2 * Math.PI);
				ctx.fill();
				ctx.globalCompositeOperation = 'source-over';
			}
        }

        window.requestAnimationFrame(drawCtx);
    };

    window.requestAnimationFrame(drawCtx);
	const redraw = ()=>{
		canvasDrawing.init_time = performance.now();
		if (canvasDrawing.progress >= 1){
			drawCtx();
		}
	};
    parentNode.addEventListener('resize', redraw, {passive: true});
// 	canvas.addEventListener('mousemove', redraw, {passive: true});

}


window.addEventListener('load', ()=>{
    for (const el of document.getElementsByClassName('dyn-logo')){
        DynamicLogo(el);
    }
})

