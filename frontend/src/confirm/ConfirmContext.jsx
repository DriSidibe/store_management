import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((message, options = {}) => {
    setState({ message, title: options.title || 'Confirmer', danger: options.danger ?? true })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const handleClose = (result) => {
    setState(null)
    resolver.current?.(result)
    resolver.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => handleClose(false)}
        title={state?.title}
        footer={
          <>
            <Button variant="outline" onClick={() => handleClose(false)}>Annuler</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => handleClose(true)}>
              Confirmer
            </Button>
          </>
        }
      >
        {state?.message}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
