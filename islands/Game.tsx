/** @jsx h */
import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Exome, getExomeId, loadState, onAction } from "exome";

import { buildPayload, Controller, Me, room } from "../store/game.ts";
import { useStore } from "../utils/use-store.ts";

// import { Button } from "../components/Button.tsx";

interface GameProps {}

const me = new Me();

function PlayerSelfComponent({ controller }: { controller: Controller }) {
  const {name, keys: [keyUp, keyDown, keyLeft, keyRight], x, y, actions, addAction, removeAction } = useStore(controller);

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === keyUp) {
        e.preventDefault();

        if (actions.indexOf('up') > -1) {
          return;
        }

        addAction('up');
        return;
      }

      if (e.key === keyDown) {
        e.preventDefault();

        if (actions.indexOf('down') > -1) {
          return;
        }

        addAction('down');
        return;
      }

      if (e.key === keyLeft) {
        e.preventDefault();

        if (actions.indexOf('left') > -1) {
          return;
        }

        addAction('left');
        return;
      }

      if (e.key === keyRight) {
        e.preventDefault();

        if (actions.indexOf('right') > -1) {
          return;
        }

        addAction('right');
        return;
      }

      console.log(e.key);
    }

    function handleKeyRelease(e: KeyboardEvent) {
      if (e.key === keyUp) {
        removeAction('up');
        return;
      }

      if (e.key === keyDown) {
        removeAction('down');
        return;
      }

      if (e.key === keyLeft) {
        removeAction('left');
        return;
      }

      if (e.key === keyRight) {
        removeAction('right');
        return;
      }

      console.log(e.key);
    }

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyRelease);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyRelease);
    };
  }, []);

  return (
    <div>
      <strong>ME: {name}</strong>
      <pre>
        {JSON.stringify({
          x, y, actions,
        }, null, 2)}
      </pre>
    </div>
  );
}

function PlayerComponent({ controller }: { controller: Controller }) {
  const { name, x, y, actions } = useStore(controller);

  return (
    <div>
      <strong>{name}</strong>
      <pre>
        {JSON.stringify({
          x, y, actions,
        }, null, 2)}
      </pre>
    </div>
  );
}

export default function Game(props: GameProps) {
  // const [sync, setSync] = useState('null');
  const roomData = useStore(room);
  const meData = useStore(me);

  useEffect(() => {
    console.log(loadState)
    const ws = new WebSocket('ws://localhost:8000/api/ws');

    ws.onclose = () => {
      console.log('izmeta no spēles');
    }

    ws.onerror = () => {
      console.log('error');
    }

    ws.onmessage = (e) => {
      console.log('message', e);
      const { type, data } = JSON.parse(e.data);

      if (type === 'sync') {
        // setSync(data);
        console.log(loadState(room, data));
      }

      if (type === 'me') {
        // setSync(data);
        console.log(loadState(me, data));

        onAction(Controller, 'addAction', (instance) => {
          if (instance !== me.controller) {
            return;
          }

          ws.send(buildPayload('actions', instance));
          // console.log('UPDATE ME addAction', instance.actions.toString());
        });

        onAction(Controller, 'removeAction', (instance) => {
          if (instance !== me.controller) {
            return;
          }

          ws.send(buildPayload('actions', instance));
          // console.log('UPDATE ME removeAction', instance.actions.toString());
        });
      }
    }

    ws.onopen = (e) => {
      console.log(e);
    }

    // console.log(ws);
  }, []);

  return (
    <div>
      GAME
      <h2>Hello {meData.controller?.name}</h2>
      <h2>Room:</h2>
      {meData.controller && (
        <PlayerSelfComponent
          controller={meData.controller}
        />
      )}
      {roomData.connections.map((player) => {
        if (getExomeId(player.controller) === getExomeId(meData.controller)) {
          return null;
        }

        return (
          <PlayerComponent
            controller={player.controller}
          />
        );
      })}
      {/* <pre>{JSON.stringify(roomData, null, 2)}</pre> */}
    </div>
  );
}
