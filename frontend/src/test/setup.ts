import '@testing-library/jest-dom';

// jsdom 未实现 matchMedia，而 useMediaQuery(useIsMobile) 在挂载时会调用它。
// 这里提供一个最小实现，默认按桌面端（非 mobile）返回，避免抛 "Not implemented"。
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Radix UI（如 Progress）在 jsdom 下依赖 ResizeObserver，提供一个空实现避免报错。
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error 测试环境注入
  globalThis.ResizeObserver = ResizeObserverMock;
}
