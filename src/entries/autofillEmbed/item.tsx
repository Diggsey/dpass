import { FunctionalComponent } from "preact"
import { VaultItem } from "../shared/state"

type ItemInfo = {
    displayName: string,
    vaultName: string,
    vaultId: string,
    itemId: string,
    item: VaultItem,
}

type AutofillItemProps = {
    item: ItemInfo,
    chooseItem: (item: ItemInfo) => void,
}

export const AutofillItem: FunctionalComponent<AutofillItemProps> = ({ item, chooseItem }) => {
    return <div class="box is-clickable" onClick={() => chooseItem(item)}>
        <h4>{item.displayName}</h4>
        <h5>{item.vaultName}</h5>
    </div>
}
