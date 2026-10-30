import Game from './Game.js';
import UI from './UI.js';

const canvas = document.getElementById('gameCanvas');
const ui = new UI();
new Game(canvas, ui);
