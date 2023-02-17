import { FunctionalComponent } from "preact";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import "./style.css";
import { ModalProps, renderModal } from "../shared/modal";
import { useUnprivilegedState } from "../shared/unprivileged";
import { useEffect, useMemo, useState } from "preact/hooks";
import { computeItemDisplayName, UnprivilegedState, VaultItemField } from "../shared/state";
import { AutofillItem } from "./item";
import { defaultName } from "../shared/autofill";
import { Field } from "../shared/components/field";
import { IconButton } from "../shared/components/iconButton";

type AutofillInnerProps = {
    state: UnprivilegedState,
} & ModalProps<"autofillEmbed">

const AutofillInner: FunctionalComponent<AutofillInnerProps> = ({ state, args, resolve, reject }) => {
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
        if (allItems.length === 1 && !args.manual) {
            chooseItem(allItems[0])
        }
    }, [allItems.length, args.manual])

    const [fields, setFields] = useState<VaultItemField[]>(() => (
        args.fields.map(f => ({
            uuid: crypto.randomUUID(),
            name: defaultName(f.autofillModes[0]),
            autofillMode: f.autofillModes[0],
            value: f.value,
        }))
    ))

    const addField = () => {
        setFields([...fields, {
            uuid: crypto.randomUUID(),
            name: "Password",
            autofillMode: { id: "password" },
            value: "",
        }])
    }

    return <div class="columns is-mobile">
        <div class="column is-one-quarter">
            {allItems.map(item => <AutofillItem item={item} chooseItem={chooseItem} />)}
            {allItems.length === 0 ? <div>No applicable vault items</div> : null}
            <div>
                <button type="button" class="button" onClick={() => reject(null)}>Cancel</button>
            </div>
        </div>
        <div class="column">
            {fields.map((f, i) => (
                <Field
                    field={f}
                    onUpdate={(nf => setFields([...fields.slice(0, i), nf, ...fields.slice(i + 1)]))}
                    onDelete={() => setFields([...fields.slice(0, i), ...fields.slice(i + 1)])}
                />
            ))}
            <div class="field">
                <div class="control">
                    <IconButton iconClass="fas fa-plus" onClick={addField}>Add new field</IconButton>
                </div>
            </div>
        </div>
    </div>
}

const AutofillEmbed: FunctionalComponent<ModalProps<"autofillEmbed">> = ({ args, resolve, reject }) => {
    const state = useUnprivilegedState(args.origin)
    return <article class="panel is-primary">
        <p class="panel-heading">
            <div class="icon-text">
                <span class="icon">
                    <i class="fas fa-pen-to-square"></i>
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
