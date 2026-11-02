import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'ghost', className = '', ...rest }: ButtonProps): React.JSX.Element {
  return <button className={`btn btn--${variant} ${className}`.trim()} {...rest} />
}
