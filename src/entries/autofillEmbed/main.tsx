import { FunctionalComponent } from "preact";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import "./style.css";
import { ModalProps, renderModal } from "../shared/modal";
import { useUnprivilegedState } from "../shared/unprivileged";
import { useEffect, useMemo } from "preact/hooks";
import { computeItemDisplayName, UnprivilegedState, VaultItem } from "../shared/state";

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

const AutofillItem: FunctionalComponent<AutofillItemProps> = ({ item, chooseItem }) => {
    return <div class="box is-clickable" onClick={() => chooseItem(item)}>
        <h4>{item.displayName}</h4>
        <h5>{item.vaultName}</h5>
    </div>
}

type AutofillInnerProps = {
    state: UnprivilegedState,
} & ModalProps<"autofillEmbed">

const AutofillInner: FunctionalComponent<AutofillInnerProps> = ({ state, resolve, reject }) => {
    const allItems = useMemo(() => {
        const allItems = Object.entries(state.vaults)
            .flatMap(([vaultId, vault]) => Object.entries(vault.items || {})
                .map(([itemId, item]) => ({
                    displayName: computeItemDisplayName(item),
                    vaultName: state.vaults[vaultId].name,
                    vaultId,
                    itemId,
                    item,
                }))
            )
        allItems.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.vaultName.localeCompare(b.vaultName) || a.itemId.localeCompare(b.itemId))
        return allItems
    }, [state.vaults])

    const chooseItem = ({ vaultId, itemId }: { vaultId: string, itemId: string }) => {
        resolve({
            id: "requestAutofill",
            vaultId,
            itemId,
        })
    }

    useEffect(() => {
        if (allItems.length === 1) {
            chooseItem(allItems[0])
        }
    }, [allItems.length])

    return <div>
        {allItems.map(item => <AutofillItem item={item} chooseItem={chooseItem} />)}
        {allItems.length === 0 ? <div>No applicable vault items</div> : null}
        <div>
            <button type="button" class="button" onClick={() => reject(null)}>Cancel</button>
        </div>
    </div>
}

const AutofillEmbed: FunctionalComponent<ModalProps<"autofillEmbed">> = ({ args, resolve, reject }) => {
    const state = useUnprivilegedState(args.origin)
    return <article class="panel is-primary">
        <p class="panel-heading">
            <div class="icon-text">
                <span class="icon">
                    <i class="fas fa-pen-field"></i>
                </span>
                <span>dpass: Auto-fill</span>
            </div>
        </p>
        <div class="panel-block">
            {state ? <AutofillInner state={state} args={args} resolve={resolve} reject={reject} /> : <div class="loader" />}
        </div>
    </article>
}

renderModal("autofillEmbed", AutofillEmbed)
