import { HttpClient } from "../http.js";
import type {
  ClickParams,
  CursorInfo,
  DesktopActionResult,
  DoubleClickParams,
  DragParams,
  KeyParams,
  LaunchParams,
  ScrollParams,
  TypeParams,
  WaitParams,
  WindowFocusParams,
  WindowInfo,
} from "../types.js";

export class Desktop {
  private readonly http: HttpClient;
  private readonly computerId: string;

  constructor(http: HttpClient, computerId: string) {
    this.http = http;
    this.computerId = computerId;
  }

  private base(): string {
    return `/computers/${this.computerId}/desktop`;
  }

  /** Capture a screenshot of the desktop. Returns raw PNG bytes. */
  async screenshot(): Promise<Uint8Array> {
    return this.http.getBinary(`${this.base()}/screenshot`);
  }

  /** Click at the given coordinates. */
  async click(
    x: number,
    y: number,
    button: ClickParams["button"] = "left",
  ): Promise<DesktopActionResult> {
    return this.http.post<DesktopActionResult>(`${this.base()}/click`, {
      x,
      y,
      button,
    });
  }

  /** Double-click at the given coordinates. */
  async doubleClick(x: number, y: number): Promise<DesktopActionResult> {
    const params: DoubleClickParams = { x, y };
    return this.http.post<DesktopActionResult>(
      `${this.base()}/double-click`,
      params,
    );
  }

  /** Type text into the currently focused element. */
  async type(text: string, delay?: number): Promise<DesktopActionResult> {
    const params: TypeParams = { text, ...(delay !== undefined && { delay }) };
    return this.http.post<DesktopActionResult>(`${this.base()}/type`, params);
  }

  /** Send a key or key combination (e.g. "Enter", "ctrl+c"). */
  async key(key: string): Promise<DesktopActionResult> {
    const params: KeyParams = { key };
    return this.http.post<DesktopActionResult>(`${this.base()}/key`, params);
  }

  /** Scroll in a direction at an optional position. */
  async scroll(
    direction: ScrollParams["direction"],
    clicks: number = 3,
    x?: number,
    y?: number,
  ): Promise<DesktopActionResult> {
    const params: ScrollParams = {
      direction,
      clicks,
      ...(x !== undefined && { x }),
      ...(y !== undefined && { y }),
    };
    return this.http.post<DesktopActionResult>(`${this.base()}/scroll`, params);
  }

  /** Click and drag from one coordinate to another. */
  async drag(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): Promise<DesktopActionResult> {
    const params: DragParams = {
      from_x: fromX,
      from_y: fromY,
      to_x: toX,
      to_y: toY,
    };
    return this.http.post<DesktopActionResult>(`${this.base()}/drag`, params);
  }

  /** Wait for the given number of seconds. */
  async wait(seconds: number): Promise<DesktopActionResult> {
    const params: WaitParams = { seconds };
    return this.http.post<DesktopActionResult>(`${this.base()}/wait`, params);
  }

  /** List all open windows on the desktop. */
  async windows(): Promise<WindowInfo[]> {
    const result = await this.http.get<{ windows: WindowInfo[] }>(
      `${this.base()}/windows`,
    );
    return result.windows;
  }

  /** Get the current cursor position. */
  async cursor(): Promise<CursorInfo> {
    return this.http.get<CursorInfo>(`${this.base()}/cursor`);
  }

  /** Bring the given window into focus. */
  async focusWindow(windowId: string): Promise<DesktopActionResult> {
    const params: WindowFocusParams = { window_id: windowId };
    return this.http.post<DesktopActionResult>(
      `${this.base()}/window/focus`,
      params,
    );
  }

  /** Launch an application by name. */
  async launch(appName: string): Promise<DesktopActionResult> {
    const params: LaunchParams = { app_name: appName };
    return this.http.post<DesktopActionResult>(`${this.base()}/launch`, params);
  }
}
