import { Exome, registerLoadable } from 'exome';

import { getRandomColor } from '../utils/color.ts';
import { generateName } from '../utils/generate-name.ts';

import { Player } from './game.ts';

export class Controller extends Exome {
  public name = generateName();
  public color = getRandomColor();
  public player?: Player;

  public setPlayer(player: Player) {
    this.player = player;
  }
}
export class KeyboardArrowController extends Controller {
  public keybinding = [
    ' ',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ];
}

export class KeyboardWasdController extends Controller {
  public keybinding = [
    'w',
    's',
    'a',
    'd',
  ];
}

export class Controllers extends Exome {
  public controllers: (KeyboardArrowController | KeyboardWasdController | null)[] = [
    null,
    null,
    null,
    null,
  ];

  public addController(controller: Exclude<Controllers['controllers'][0], null>) {
    const firstFreeIndex = this.controllers.indexOf(null);

    if (firstFreeIndex === -1) {
      alert('No free spots in party');
      return;
    }

    this.controllers[firstFreeIndex] = controller;
  }

  public removeController(controller: Exclude<Controllers['controllers'][0], null>) {
    const controllerToRemove = this.controllers.indexOf(controller);
    this.controllers[controllerToRemove] = null;
  }
}

registerLoadable({
  KeyboardArrowController,
  KeyboardWasdController,
  Controllers,
});
