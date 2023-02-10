import { FunctionalComponent, render } from "preact";
import { useEffect } from "preact/hooks";
import { usePrivilegedState } from "../shared/privileged/hooks";
import "./style.css";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import { UnlockPanel } from "../shared/components/unlockForm";


const Popup: FunctionalComponent = () => {
    const state = usePrivilegedState()
    const isSuper = state?.isSuper
    const isUnlocked = !!state?.isUnlocked
    const isSetUp = !!state?.isSetUp

    useEffect(() => {
        if (isSuper) {
            window.close()
        }
    }, [isSuper])

    return <div><UnlockPanel isSetUp={isSetUp} isUnlocked={isUnlocked} /></div>
}

render(<Popup />, document.body)
