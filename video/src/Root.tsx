import { Composition } from "remotion";
import { Opening } from "./scenes/Opening";
import { Pipeline } from "./scenes/Pipeline";
import { RiskDrop } from "./scenes/RiskDrop";
import { Outro } from "./scenes/Outro";
import { FPS, HEIGHT, WIDTH, sec } from "./theme";

export const RemotionRoot = () => (
  <>
    <Composition id="Opening" component={Opening} durationInFrames={sec(38)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Pipeline" component={Pipeline} durationInFrames={sec(62.5)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="RiskDrop" component={RiskDrop} durationInFrames={sec(50)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Outro" component={Outro} durationInFrames={sec(20)} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
