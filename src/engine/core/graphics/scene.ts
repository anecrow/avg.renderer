import {
  SpriteAnimateDirector,
  AnimateTargetType
} from "./sprite-animate-director";
import * as PIXI from "pixi.js";
// import * as Loader from "resource-loader";

import { LayerOrder } from "./layer-order";
import { Sprite, ResizeMode } from "./sprite";
import * as gsap from "gsap";
import { findFilter } from "./pixi-utils";
import { isNullOrUndefined } from "util";
import { PIXIGif } from "./pixi-gif/pixi-gif";
import { SpriteType } from "engine/const/sprite-type";
import { ResourceManager } from "../resource-manager";
import { SpriteDebugger } from "./sprite-debugger";
import { TestFilterObj } from "./filters/avg-extras/test";

export class Scene {
  isTilingMode = false;
  focalVisibility = 0;
  enabledCamera = false;

  public app: PIXI.Application;
  public stage: PIXI.Container;
  public renderer: PIXI.Renderer;
  public view: HTMLCanvasElement;

  protected mainContainer: PIXI.Container = new PIXI.Container();
  protected transitionContainer: PIXI.Container = new PIXI.Container();

  // 摄像机参数
  private currentCameraData = {
    x: 0,
    y: 0,
    distance: 0
  };

  constructor(
    app: PIXI.Application,
    private width: number,
    private height: number
  ) {
    this.app = app;
    this.stage = this.app.stage;
    this.view = this.app.view;
    this.renderer = this.app.renderer;

    this.view.style.position = "absolute";
    this.view.style.display = "block";
    this.view.style.overflow = "scroll";
    this.renderer.backgroundColor = 0;

    this.mainContainer.width = width;
    this.mainContainer.height = height;

    this.stage.addChild(this.mainContainer);

    this.app.ticker.add(() => {
      // 检查资源加载
      ResourceManager.update();

      this.children().map(sprite => {
        if (!(sprite instanceof Sprite)) {
          return;
        }

        const xRadio = this.renderer.width / sprite.texture.width;
        const yRadio = this.renderer.height / sprite.texture.height;

        // 拉伸图像
        switch (sprite.resizeMode) {
          case ResizeMode.Stretch: {
            if (!sprite.renderInCamera) {
              if (sprite.scale.x !== xRadio) {
                sprite.scale.x = xRadio;
              }

              if (sprite.scale.y !== yRadio) {
                sprite.scale.y = yRadio;
              }
            }
            break;
          }
          case ResizeMode.KeepRadio: {
            if (!sprite.renderInCamera) {
              const ratio = Math.min(xRadio, yRadio);
              sprite.scale.x = sprite.scale.y = ratio;
            }
            break;
          }
          case ResizeMode.Default: {
            if (!sprite.renderInCamera) {
              // sprite.scale.set(1, 1);
            }
            break;
          }
          case ResizeMode.Custom: {
            break;
          }
        }

        // 处理镜头焦距
        if (this.enabledCamera) {
          const zoom = sprite.scale.x;

          // 模糊系数
          if (this.focalVisibility && sprite.renderInCamera && zoom > 2.2) {
            // 透明系数
            sprite.alpha = 1 - zoom * 0.02;

            let blurFilter = <PIXI.filters.BlurFilter>(
              findFilter(sprite, "BlurFilter")
            );

            const blurRatio = zoom * this.focalVisibility;

            if (blurFilter) {
              blurFilter.blur = blurRatio;
            } else {
              blurFilter = new PIXI.filters.BlurFilter(0);
              blurFilter.blur = blurRatio;
              sprite.filters.push(blurFilter);
            }
          } else {
            // sprite.filters = [];
          }
        }

        if (sprite.spriteDebugger) {
          sprite.spriteDebugger.update();
        }
      });
    });
  }

  /**
   * 触发尺寸变更事件，由 World 主动调用，用于调整图形比例
   *
   * @memberof Scene
   */
  public onResize() {
    const xRatio = this.renderer.width / this.width;
    const yRatio = this.renderer.height / this.height;

    console.log("On Scene Resized: ", xRatio, yRatio);

    this.children().map(sprite => {
      // 计算立绘的坐标
      if (sprite.spriteType === SpriteType.Character) {
        sprite.x = sprite.initialX * xRatio;
        sprite.spriteDebugger.update();
      } else if (sprite.spriteType === SpriteType.Scene) {
        this.stretch(sprite);
        this.centerSprite(sprite);
      }
    });

    console.log("On Scene resized.", xRatio, yRatio);
  }

  /**
   * 拉伸
   *
   * @param {Sprite} sprite
   * @memberof Scene
   */
  public stretch(sprite: Sprite) {
    if (sprite.renderer.stretch) {
      sprite.width = this.renderer.width;
      sprite.height = this.renderer.height;
    }
  }

  /**
   * 处理居中
   *
   * @param {Sprite} sprite
   * @memberof Scene
   */
  public centerSprite(sprite: Sprite) {
    if (sprite.center) {
      const x = this.renderer.width * sprite.anchor.x;
      const y = this.renderer.height * sprite.anchor.y;
      sprite.position.set(x, y);
    }
  }

  /**
   * 开启摄像机
   *
   * @memberof Scene
   */
  public enableCamera() {
    this.enabledCamera = true;
  }

  /**
   * 设置焦距视觉效果
   *
   * @param {number} value
   *    该值越大镜头拉近时精灵的模糊程度和透明程度越高
   * @memberof Scene
   */
  public setCameraFocalVisibility(value: number) {
    this.focalVisibility = value;
  }

  public cameraMove(x: number, y: number, duration: number = 2000) {
    this.currentCameraData.x = x;
    this.currentCameraData.y = y;

    this.children().map(sprite => {
      this.updateCameraMoveRendering(
        sprite,
        this.currentCameraData.x,
        this.currentCameraData.y,
        duration
      );
    });
  }

  public cameraZoom(distance: number, duration: number = 2000) {
    this.currentCameraData.distance += distance;

    this.children().map(sprite => {
      this.updateCameraZoomRendering(
        sprite,
        this.currentCameraData.distance,
        duration
      );
    });
  }
  /**
   * 更新摄像机移动渲染
   *
   * @memberof Scene
   */
  public updateCameraMoveRendering(
    sprite: Sprite,
    x: number,
    y: number,
    duration: number
  ) {
    console.log("updateCameraMoveRendering", x, y);

    if (!sprite.renderInCamera) {
      return;
    }

    const moveVector = 3000;

    // 取镜头距离差值转换为正整数
    const distanceDiff =
      Sprite.MAX_CAMERA_DISTANCE - Sprite.MIN_CAMERA_DISTANCE;
    const spriteDistance = sprite.distance + distanceDiff / 2;

    const compensation = 0.5; // 移动补偿，防止最远距离的移动倍率为0
    const moveRatio =
      ((distanceDiff + sprite.distance) / (distanceDiff / 2)) *
      (spriteDistance / distanceDiff);

    const moveX = -(x * moveRatio + compensation) + sprite.x;
    const moveY = -(y * moveRatio + compensation) + sprite.y;

    let moveData: any = {};

    if (x) {
      moveData["x"] = moveX;
    }

    if (y) {
      moveData["y"] = moveY;
    }

    if (sprite.isTilingMode) {
      gsap.TweenLite.to((<any>sprite).tilePosition, duration / 1000, moveData);
    } else {
      gsap.TweenLite.to(sprite.position, duration / 1000, moveData);
    }
  }

  /**
   * 更新摄像机距离渲染
   *
   * @param {Sprite} sprite
   * @param {number} distance
   * @param {number} duration
   * @returns
   * @memberof Scene
   */
  public updateCameraZoomRendering(
    sprite: Sprite,
    distance: number,
    duration: number
  ) {
    if (!sprite.renderInCamera) {
      return;
    }

    if (!sprite.renderCameraDepth) {
      return;
    }

    const distanceDiff =
      Sprite.MAX_CAMERA_DISTANCE - Sprite.MIN_CAMERA_DISTANCE;

    const spriteDistance = sprite.distance + distanceDiff / 2;
    const zoomDistance = distance + distanceDiff / 2;

    let zoom = spriteDistance / zoomDistance;

    if (zoom <= 0 || zoom === Infinity) {
      zoom = 0;
    }

    gsap.TweenLite.to(sprite.scale, duration / 1000, {
      x: zoom * (sprite.scale.x > 0 ? 1 : -1),
      y: zoom * (sprite.scale.y > 0 ? 1 : -1)
    });
  }

  public get(orderOrIndex: number | LayerOrder = LayerOrder.TopLayer): Sprite {
    return <Sprite>this.children()[this.orderToIndex(orderOrIndex)];
  }

  public getSpriteByName(name: string): Sprite {
    return this.children().find((sprite, index) => {
      return sprite.name === name;
    });
  }

  public addSprite(
    name: string,
    sprite: Sprite,
    zOrder: number | LayerOrder = LayerOrder.TopLayer
  ) {
    sprite.zOrder = this.orderToIndex(zOrder);
    sprite.name = name;

    // 设置为原图大小
    // sprite.width = sprite.texture.width;
    // sprite.height = sprite.texture.height;

    // 添加到主容器
    this.mainContainer.addChild(sprite);

    // 图层排序
    this.sortChildren();

    // 触发摄像机渲染
    // this.updateCameraMoveRendering(sprite, sprite.x, sprite.y, 1);
    this.updateCameraZoomRendering(sprite, 0, 1);
  }

  public static to(target: {}, duration: number, vars: {}, position?: any) {
    const timeline = new gsap.TimelineMax();
    return timeline.to(target, duration / 1000, vars, position);
  }

  public addFilter(...filters: Array<PIXI.Filter>) {
    filters.map(filter => {
      this.stage.filters.push(filter);
    });
  }

  public children() {
    return <Sprite[]>this.mainContainer.children || [];
  }

  public clear() {
    this.mainContainer.removeChildren();
  }

  private orderToIndex(zOrder: number | LayerOrder = LayerOrder.TopLayer) {
    let insertPosition = this.children().length;
    if (typeof zOrder === "number") {
      insertPosition = zOrder;
    } else {
      if (zOrder === LayerOrder.BottomLayer) {
        insertPosition = 0;
      } else if (zOrder === LayerOrder.TopLayer) {
        insertPosition = this.children().length + 1;
      }
    }

    return insertPosition;
  }

  public getView() {
    return this.app.view;
  }

  public getApp() {
    return this.app;
  }

  public getStage() {
    return this.app.stage;
  }

  private sortChildren() {
    // TODO: 可优化，放到帧循环中进行排序
    const children: Sprite[] = this.children();

    const len = children.length;
    let i, j, tmp;

    for (i = 1; i < len; i++) {
      tmp = children[i];
      j = i - 1;
      while (j >= 0) {
        if (tmp.zOrder < children[j].zOrder) {
          children[j + 1] = children[j];
        } else if (
          tmp.zOrder === children[j].zOrder &&
          tmp.arrivalOrder < children[j].arrivalOrder
        ) {
          children[j + 1] = children[j];
        } else {
          break;
        }

        j--;
      }

      children[j + 1] = tmp;
    }
  }

  public setTilingMode(value: boolean) {
    this.isTilingMode = value;

    this.children().map(sprite => {
      const texture = sprite.texture;
    });

    console.log("Enabled tiling mode: ", this.children());
  }

  public async loadFromImage(
    name: string,
    url: string,
    type: SpriteType = SpriteType.Normal
  ): Promise<Sprite> {
    return new Promise<Sprite>((resolve, reject) => {
      ResourceManager.addLoading(url, resource => {
        console.log("On resource loaded: ", resource);
        let sprite: Sprite;

        if (resource.extension === "gif") {
          sprite = new PIXIGif(type, url, resource).sprite;
        } else {
          sprite = new Sprite(type, PIXI.Texture.from(resource.data));
        }

        sprite.name = name;

        resolve(sprite);
      });
    });
  }

  public removeSprite(id: string) {
    const sprite = this.getSpriteByName(id);
    if (sprite) {
      this.mainContainer.removeChild(sprite);
    }
  }

  public hasSprite(name: string) {
    const sprite = this.mainContainer.children.find(s => {
      return s.name === name;
    });

    return !isNullOrUndefined(sprite);
  }
}
