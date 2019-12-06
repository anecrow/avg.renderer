import * as PIXI from "pixi.js";

import { Sprite } from "./sprite";
import { Scene } from "./scene";
import { DebugPanel } from "app/common/debugger/debug-panel";
import { HookManager } from "engine/plugin/hooks/hook-manager";
import { HookEvents } from "engine/plugin/hooks/hook-events";
import { DropFlakeParticle } from "./shaders/drop-flake/drop-flake";
import { AVGNativePath } from "../native-modules/avg-native-path";
import { GameResource } from "../resource";
import { ScalingSystem } from "./scaling-system";

class World {
  scenes: Scene[] = [];
  public app: PIXI.Application;
  _defaultScene: Scene;

  parentElement: HTMLElement;
  worldWidth: number;
  worldHeight: number;

  frameBuffer: PIXI.Framebuffer;

  async init(
    parentElement: HTMLElement,
    width: number = 1920,
    height: number = 1080
  ) {
    // [16: 9] - 800x450, 1024x576, 1280x760, 1920x1080

    this.worldWidth = width;
    this.worldHeight = height;

    this.parentElement = parentElement;

    this.app = new PIXI.Application({
      width,
      height,
      antialias: true,
      preserveDrawingBuffer: true,
      transparent: true,
      backgroundColor: 0,
      resizeTo: this.parentElement,
      resolution: 1
    });

    this.app.renderer.addSystem(ScalingSystem as any, 'scaling');

    /*this.frameBuffer = new PIXI.Framebuffer(width, height);
    this.frameBuffer.addColorTexture(1, PIXI.Texture.fromBuffer(null, width, height));
    this.app.renderer.framebuffer.bind(this.frameBuffer);
    this.frameBuffer = PIXI.RenderTexture.create({width: width, height: height});
    this.app.renderer.renderTexture.bind(this.frameBuffer);
    this.app.renderer.runners.postrender.add({
      postrender:
        function(){
          let color = new Date().getTime() % 65536;
          let colorCode = "";
          let hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
          colorCode = hex[color % 16] + colorCode;
          color = color / 16;
          colorCode = hex[color % 16] + colorCode;
          color = color / 16;
          colorCode = hex[color % 16] + colorCode;
          color = color / 16;
          colorCode = hex[color % 16] + colorCode;
          color = color / 16;
          colorCode = hex[color % 16] + colorCode;
          color = color / 16;
          colorCode = hex[color % 16] + colorCode;
          color = color / 16;
          document.body.style.backgroundColor = "#" + colorCode;
        }
    });*/

    // Show FPSPanel
    // const fpsElement = document.getElementById("fps");
    this.app.ticker.add(() => {
      //   fpsElement.innerHTML = GameWorld.app.ticker.FPS.toPrecision(2) + " fps";

      HookManager.triggerHook(HookEvents.GameUpdate);
    });

    this._defaultScene = new Scene(this.app, this.worldWidth, this.worldHeight);
    this.addScene(this._defaultScene);
    /*window.onresize = () => {
      this.app.resize();
      
      this.scenes.map(scene => {
        scene.onResize();
      });
    };*/

    // DebugPanel.init();
  }

  public get defaultScene() {
    return this._defaultScene;
  }

  public addScene(scene: Scene) {
    this.scenes.push(scene);
    this.parentElement.appendChild(scene.getView());
  }

  public transitionTo(scene: Scene, scene2: Sprite, effect?: number) {}
}

export const GameWorld = new World();
