import { mixin } from "../mixin"

export interface IObjectId {
    get objectId(): string
}

let nextObjectId = 1

export const ObjectId = mixin<IObjectId>(Base => (class ObjectId extends Base implements IObjectId {
    #objectId: string | null = null

    #newObjectId(): string {
        return `${this.constructor.name}-${nextObjectId++}`
    }

    get objectId() {
        if (this.#objectId === null) {
            this.#objectId = this.#newObjectId()
        }
        return this.#objectId
    }

    toString(): string {
        return `[${this.objectId}]`
    }
}))
