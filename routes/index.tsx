import Counter from "../islands/Counter.tsx";
import Game from "../islands/Game.tsx";

export default function Home() {
  return (
    <div>
      {/* <img
        src="/logo.svg"
        height="100px"
        alt="the fresh logo: a sliced lemon dripping with juice"
      />
      <p>
        Welcome to `fresh`. Try updating this message in the ./routes/index.tsx
        file, and refresh.
      </p>
      <Counter start={3} /> */}
      <Game />
    </div>
  );
}
