import StartGame from './game/main';
import { getResponsiveGameSize } from './game/responsive';

document.addEventListener('DOMContentLoaded', () => {

    const game = StartGame('game-container');
    const app = document.querySelector('#app');

    if (!app) {
        return;
    }

    const resizeGame = () => {
        const { width, height } = app.getBoundingClientRect();
        const gameSize = getResponsiveGameSize(width, height);

        game.scale.resize(gameSize.width, gameSize.height);
    };

    const observer = new ResizeObserver(resizeGame);

    observer.observe(app);
    resizeGame();

});