export const MAX_GAME_WIDTH = 1920;
export const MAX_GAME_HEIGHT = 1920;

export const getResponsiveGameSize = (
    availableWidth,
    availableHeight
) => {
    const pixelRatio = window.devicePixelRatio || 1;

    const safeWidth = Math.max(1, Math.floor(availableWidth));
    const safeHeight = Math.max(1, Math.floor(availableHeight));

    // Base size preserving aspect ratio
    const aspectRatio = safeWidth / safeHeight;

    // Find how much we can upscale while staying within max limits
    const maxScaleX = Math.floor(MAX_GAME_WIDTH / safeWidth);
    const maxScaleY = Math.floor(MAX_GAME_HEIGHT / safeHeight);

    const upscaleFactor = Math.max(
        1,
        Math.min(maxScaleX, maxScaleY)
    );

    return {
        width: Math.floor(safeWidth * upscaleFactor * pixelRatio),
        height: Math.floor(safeHeight * upscaleFactor * pixelRatio),
        scale: upscaleFactor
    };
};