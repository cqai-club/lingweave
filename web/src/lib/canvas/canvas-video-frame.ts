export async function captureVideoFrame(url: string, time?: number) {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("视频无法读取")), { once: true });
        video.load();
    });
    const targetTime = Math.max(0, Math.min(Number.isFinite(time) ? Number(time) : 0, Number.isFinite(video.duration) ? video.duration : 0));
    if (targetTime > 0) {
        await new Promise<void>((resolve, reject) => {
            video.addEventListener("seeked", () => resolve(), { once: true });
            video.addEventListener("error", () => reject(new Error("视频帧读取失败")), { once: true });
            video.currentTime = targetTime;
        });
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, time: video.currentTime, duration: video.duration };
}
