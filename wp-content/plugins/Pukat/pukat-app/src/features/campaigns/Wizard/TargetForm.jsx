import { useState } from 'react'
import Input from '../../../components/UI/Input.jsx'
import Button from '../../../components/UI/Button.jsx'

const EMPTY_VALUES = { first_name: '', last_name: '', email: '', position: '', department: '' }

function validate(values) {
  const errors = {}
  if (!values.first_name.trim()) errors.first_name = 'First name is required'
  if (!values.email.trim() || !values.email.includes('@')) errors.email = 'Valid email is required'
  return errors
}

export default function TargetForm({ initialValues, onSubmit, onCancel, submitLabel = 'Add target' }) {
  const [values, setValues] = useState({ ...EMPTY_VALUES, ...initialValues })
  const [errors, setErrors] = useState({})

  function setField(field) {
    return (e) => setValues(v => ({ ...v, [field]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSubmit({ ...values, first_name: values.first_name.trim(), email: values.email.trim() })
    if (!onCancel) setValues(EMPTY_VALUES)
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
      <Input
        placeholder="First name *"
        value={values.first_name}
        onChange={setField('first_name')}
        error={!!errors.first_name}
        errorMessage={errors.first_name}
      />
      <Input
        placeholder="Last name"
        value={values.last_name}
        onChange={setField('last_name')}
      />
      <Input
        type="email"
        placeholder="Email *"
        value={values.email}
        onChange={setField('email')}
        error={!!errors.email}
        errorMessage={errors.email}
      />
      <Input
        placeholder="Position"
        value={values.position}
        onChange={setField('position')}
      />
      <Input
        placeholder="Department"
        value={values.department}
        onChange={setField('department')}
      />
      <div className="md:col-span-5 flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  )
}
