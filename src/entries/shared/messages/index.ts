import { VaultItemPayload } from "../state"
import {
    AutofillPayload,
    PerformAutofillMessage,
    PokeActiveFrameMessage,
    PokeFrameResponse,
    RequestAutofillMessage,
    ShowItemSelectorMessage,
} from "./autofill"
import {
    ContentModalMessage,
    ForwardMessage,
    FrameDetails,
    GetFrameDetailsMessage,
    OpenOptionsPage,
    OptionsPageOpenedMessage,
} from "./misc"
import {
    ChangeRootPasswordMessage,
    ClearHistoryMessage,
    CreateRootMessage,
    CreateVaultMessage,
    EditRootNameMessage,
    LockMessage,
    RemoveVaultMessage,
    SetVaultAsDefaultMessage,
    UnlockMessage,
} from "./root"
import { EditStorageAddressesMessage } from "./storage"
import {
    CreateVaultItemMessage,
    DecryptVaultItemMessage,
    DeleteVaultItemMessage,
    EditVaultNameMessage,
    UpdateVaultItemMessage,
} from "./vault"
import {
    EditGeneratorSettingsMessage,
    GeneratePasswordMessage,
} from "./generators"
import {
    BackupMessage,
    ExportVaultItemsMessage,
    ImportVaultItemsMessage,
    RestoreMessage,
} from "./backup"
import { Json } from ".."

export type Message =
    | RequestAutofillMessage
    | PokeActiveFrameMessage
    | ShowItemSelectorMessage
    | PerformAutofillMessage
    | OptionsPageOpenedMessage
    | CreateRootMessage
    | EditRootNameMessage
    | EditStorageAddressesMessage
    | UnlockMessage
    | LockMessage
    | ChangeRootPasswordMessage
    | CreateVaultMessage
    | RemoveVaultMessage
    | SetVaultAsDefaultMessage
    | ClearHistoryMessage
    | EditVaultNameMessage
    | CreateVaultItemMessage
    | DeleteVaultItemMessage
    | UpdateVaultItemMessage
    | DecryptVaultItemMessage
    | GetFrameDetailsMessage
    | ContentModalMessage
    | ForwardMessage
    | OpenOptionsPage
    | EditGeneratorSettingsMessage
    | GeneratePasswordMessage
    | BackupMessage
    | RestoreMessage
    | ExportVaultItemsMessage
    | ImportVaultItemsMessage

type MessageResponses = {
    requestAutofill: AutofillPayload
    pokeActiveFrame: PokeFrameResponse
    showItemSelector: RequestAutofillMessage | null
    performAutofill: boolean
    optionsPageOpened: undefined
    createRoot: undefined
    editRootName: undefined
    editStorageAddresses: undefined
    unlock: undefined
    lock: undefined
    changeRootPassword: undefined
    createVault: string
    removeVault: undefined
    setVaultAsDefault: undefined
    clearHistory: undefined
    editVaultName: undefined
    createVaultItem: string
    deleteVaultItem: undefined
    updateVaultItem: undefined
    decryptVaultItem: VaultItemPayload
    getFrameDetails: FrameDetails
    contentModal: undefined
    forward: Json
    openOptionsPage: undefined
    editGeneratorSettings: undefined
    generatePassword: string
    backup: undefined
    restore: undefined
    exportVaultItems: undefined
    importVaultItems: undefined
}
export type MessageResponse<M extends Message = Message> =
    MessageResponses[M["id"]]
