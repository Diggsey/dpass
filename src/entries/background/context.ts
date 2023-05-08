import { Actor } from "./actor"
import { SetupKeyContext } from "./context/setupKeyContext"
import { SuperKeyContext } from "./context/superKeyContext"
import { SyncManagerContext } from "./context/syncManagerContext"
import { RootAddressesContext } from "./context/rootAddressesContext"
import { StatePublisherContext } from "./context/statePublisherContext"
import { RootContext } from "./context/rootContext"
import { VaultContext } from "./context/vaultContext"
import { PublicRootContext } from "./context/publicRootContext"
import { PublicVaultContext } from "./context/publicVaultContext"
import { PublicItemContext } from "./context/publicItemContext"
import { PublicGeneratorContext } from "./context/publicGeneratorContext"

class SecureContext extends PublicGeneratorContext(
    PublicItemContext(
        PublicVaultContext(
            PublicRootContext(
                StatePublisherContext(
                    VaultContext(
                        RootContext(
                            RootAddressesContext(
                                SyncManagerContext(
                                    SuperKeyContext(SetupKeyContext(Actor))
                                )
                            )
                        )
                    )
                )
            )
        )
    )
) {}

export const SECURE_CONTEXT = new SecureContext()
