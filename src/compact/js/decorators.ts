import { DrawParameters } from "shapez/core/draw_parameters"
import { BaseItem } from "shapez/game/base_item"
import { BeltPath } from "shapez/game/belt_path"
import { Component } from "shapez/game/component"
import { Entity } from "shapez/game/entity"
import { GameSystem } from "shapez/game/game_system"
import { MapChunkView, MOD_CHUNK_DRAW_HOOKS } from "shapez/game/map_chunk_view"
import { MetaBuilding } from "shapez/game/meta_building"
import { GameRoot } from "shapez/game/root"
import { ItemEjectorSystem } from "shapez/game/systems/item_ejector"
import { ModInterface } from "shapez/mods/mod_interface"
import { ModMetaBuilding } from "shapez/mods/mod_meta_building"
import { MOD_SIGNALS } from "shapez/mods/mod_signals"
import { override } from "./override"
import { rootSignals, signals } from "./signals"
import { getComponent } from "./util"

type X<K extends keyof ModInterface> = ModInterface[K] extends (
  ...args: any
) => any
  ? Parameters<ModInterface[K]>
  : never

export function RegisterNewBuilding(
  opts: Omit<X<"registerNewBuilding">[0], "metaClass">
) {
  return function <T extends typeof ModMetaBuilding & { getId?: () => string }>(
    metaBuildingClass: T
  ) {
    signals.modInit.add((modInterface) => {
      modInterface.registerNewBuilding({
        metaClass: metaBuildingClass,
        ...opts,
      })
    })

    //@ts-ignore
    if (!new metaBuildingClass().id) {
      const id =
        metaBuildingClass.getId?.() ??
        metaBuildingClass.name
          .match(/Meta(.+)Building/)?.[1]
          ?.split(/(?=[A-Z])/)
          .join("_")
          .toLowerCase()
      Object.defineProperty(metaBuildingClass.prototype, "id", {
        get() {
          return id
        },
        set(_) {},
      })
    }
  }
}

export function AddNewBuildingToToolbar(
  opts: Omit<X<"addNewBuildingToToolbar">[0], "metaClass">
) {
  return <T extends typeof ModMetaBuilding>(metaBuildingClass: T) => {
    signals.modInit.add((modInterface) => {
      modInterface.addNewBuildingToToolbar({
        metaClass: metaBuildingClass,
        ...opts,
      })
    })
  }
}

export function RegisterComponent() {
  return function <T extends typeof Component>(componentClass: T) {
    signals.modInit.add((modInterface) => {
      modInterface.registerComponent(componentClass)
    })

    if (!Object.hasOwnProperty.call(componentClass, "getId")) {
      const id = componentClass.name.split("Component")[0]
      componentClass.getId = function () {
        return id
      }
    }
  }
}

export type LiteralUnion<T extends string> = T | (string & Record<never, never>)
type SystemId = LiteralUnion<
  | "itemAcceptor"
  | "belt"
  | "undergroundBelt"
  | "miner"
  | "storage"
  | "itemProcessor"
  | "filter"
  | "itemProducer"
  | "itemEjector"
  | "mapResources"
  | "hub"
  | "staticMapEntities"
  | "wiredPins"
  | "beltUnderlays"
  | "constantSignal"
  | "lever"
  | "wire"
  | "logicGate"
  | "beltReader"
  | "display"
  | "itemProcessorOverlays"
  | "constantProducer"
  | "goalAcceptor"
  | "zone"
  | "end"
>

function getGameSystemId<
  T extends typeof GameSystem & { getId?: () => string }
>(systemClass: T) {
  return (
    systemClass.getId?.() ??
    systemClass.name
      .split("System")[0]
      .replace(/^[A-Z]/, (c) => c.toLowerCase())
  )
}

export function RegisterGameSystem(opts?: {
  id?: string
  updateBefore?: SystemId
}) {
  return function <T extends typeof GameSystem>(systemClass: T) {
    signals.modInit.add((modInterface) => {
      modInterface.registerGameSystem({
        systemClass: systemClass,
        id: opts?.id ?? getGameSystemId(systemClass),
        before: opts?.updateBefore ?? "end",
      })
    })
  }
}

type DrawChunkMethod = (parameters: DrawParameters, chunk: MapChunkView) => void
type DrawHookId = keyof typeof MOD_CHUNK_DRAW_HOOKS
type DrawHookPayload = {
  systemId: string
  methodName: string
  oncePerFrame: boolean
}
const drawHookSystems = new Map<DrawHookId, DrawHookPayload[]>()
function getDrawHookSystem(hookId: DrawHookId) {
  {
    const systemIds = drawHookSystems.get(hookId)
    if (systemIds) return systemIds
  }
  const systemIds: DrawHookPayload[] = []
  drawHookSystems.set(hookId, systemIds)
  signals.modInit.add((modInterface) => {
    modInterface.registerGameSystem({
      id: "draw$" + hookId + "$" + Math.random().toString().slice(2),
      systemClass: class extends GameSystem {
        newFrame = true
        constructor(root: GameRoot) {
          super(root)
          this.root.signals.gameFrameStarted.add(() => (this.newFrame = true))
        }
        drawChunk(parameters: DrawParameters, chunk: MapChunkView) {
          for (const payload of systemIds) {
            if (payload.oncePerFrame && !this.newFrame) continue
            //@ts-ignore
            const system = this.root.systemMgr.systems[payload.systemId]
            if (!system) continue
            system[payload.methodName](parameters, chunk)
          }
          this.newFrame = false
        }
      },
      before: "end",
      drawHooks: [hookId],
    })
  })
  return systemIds
}
export function DrawHook<H extends DrawHookId | undefined = undefined>(opts?: {
  hookId?: H
  oncePerFrame?: boolean
}) {
  return function (
    proto: Object,
    methodName: H extends undefined ? DrawHookId : string,
    _desc: TypedPropertyDescriptor<DrawChunkMethod>
  ) {
    const systemIds = getDrawHookSystem(
      (opts?.hookId ?? methodName) as DrawHookId
    )
    const klass = proto.constructor as typeof GameSystem
    systemIds.push({
      systemId: getGameSystemId(klass),
      methodName: methodName,
      oncePerFrame: opts?.oncePerFrame ?? false,
    })
  }
}

export function ItemPassOver() {
  return function <
    T extends typeof Component & {
      new (): { tryTakeItem(item: BaseItem, direction: string): boolean }
    }
  >(componentClass: T) {
    signals.modInit.add((modInterface) => {
      @override()
      class _Ejector extends ItemEjectorSystem {
        tryPassOverItem(
          item: BaseItem,
          receiver: Entity,
          slotIndex: number
        ): boolean {
          const comp = getComponent(receiver, componentClass)
          if (!comp) return super.tryPassOverItem(item, receiver, slotIndex)
          const acceptorComp = receiver.components.ItemAcceptor
          const direction = receiver.static.localDirectionToWorld(
            acceptorComp.slots[slotIndex].direction
          )
          return comp.tryTakeItem(item, direction)
        }
      }
      @override()
      class _Belt extends BeltPath {
        computePassOverFunctionWithoutBelts(
          receiver: Entity,
          slotIndex: number
        ) {
          const comp = getComponent(receiver, componentClass)
          if (!comp)
            return super.computePassOverFunctionWithoutBelts(
              receiver,
              slotIndex
            )
          return function (item: BaseItem) {
            const acceptorComp = receiver.components.ItemAcceptor
            const direction = receiver.static.localDirectionToWorld(
              acceptorComp.slots[slotIndex].direction
            )
            return comp.tryTakeItem(item, direction)
          }
        }
      }
    })
  }
}
export function HiddenBuilding() {
  return function <T extends typeof MetaBuilding>(metaBuildingClass: T) {
    MOD_SIGNALS.gameStarted.add((root: GameRoot) => {
      root.gameMode.hiddenBuildings.push(metaBuildingClass)
    })
  }
}

//-----------------------------------------------------------------------------

const SYMBOL_RECEIVER = Symbol()
export function SignalReceiver<T extends new (..._: any[]) => any>(klass: T) {
  return class extends klass {
    constructor(...args: any[]) {
      super(...args)
      const klass = this.constructor
      const signalReceivers = (klass as any)[SYMBOL_RECEIVER]
      if (!signalReceivers) {
        console.warn(
          "SignalReceiver: no receivers found for",
          klass.name,
          klass
        )
        return
      }
      for (const { signal, methodName } of signalReceivers) {
        signal.add(this[methodName].bind(this))
      }
    }
  } as T
}

export function OnSignal<T extends any[]>(signal: TypedSignal<T>) {
  return function (
    proto: any,
    key: string,
    _desc: TypedPropertyDescriptor<(...args: T) => any>
  ) {
    const klass = proto.constructor
    const receiver = klass[SYMBOL_RECEIVER] || (klass[SYMBOL_RECEIVER] = [])
    if (!receiver) {
      console.error("Class must have a @SignalReceiver:", klass.name)
      return
    }
    receiver.push({ signal, methodName: key })
  }
}

export function OnRootSignal(): (
  proto: any,
  key: keyof GameRoot["signals"]
) => void
export function OnRootSignal(
  signalName: keyof GameRoot["signals"]
): (proto: any, key: string) => void
export function OnRootSignal(signalName?: any) {
  return function (proto: any, key: string, desc: any) {
    //@ts-ignore
    return OnSignal(rootSignals[signalName || key])(proto, key, desc)
  } as any
}

//-----------------------------------------------------------------------------
