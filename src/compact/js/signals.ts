import { Signal as _Signal } from "shapez/core/signal"
import { GameRoot } from "shapez/game/root"
import { ModInterface } from "shapez/mods/mod_interface"
import { MOD_SIGNALS } from "shapez/mods/mod_signals"

export const Signal = _Signal as {
  new <T extends any[] = []>(): TypedSignal<T>
}

const gameSignals: GameSignal[] = []
export class GameSignal<T extends any[] = []> extends Signal<T> {
  constructor() {
    super()
    gameSignals.push(this)
  }
}

MOD_SIGNALS.gameStarted.add((root: GameRoot) => {
  root.signals.aboutToDestruct.add(() => {
    for (const signal of gameSignals) signal.removeAll()
  })
})

export const signals = {
  modInit: new Signal<[ModInterface]>(),
}

export const rootSignals = new Proxy<GameRoot["signals"]>({} as any, {
  get(target: any, key: keyof GameRoot["signals"]) {
    let signal = target[key]
    if (signal) return signal
    signal = target[key] = new GameSignal()
    MOD_SIGNALS.gameInitialized.add((root: GameRoot) => {
      root.signals[key].add(signal.dispatch.bind(signal))
    })
    return signal
  },
})
