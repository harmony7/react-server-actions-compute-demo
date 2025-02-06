'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import ErrorBoundary from './ErrorBoundary.js';

function Status() {
  const { pending } = useFormStatus();
  return pending ? 'Saving...' : null;
}

export default function Form({action, children}) {
  const [ isPending, setIsPending ] = React.useState(false);
  const [ message, formAction ] = React.useActionState((_prevState, formData) => action(formData), null);

  return (
    <ErrorBoundary>
      <form action={formAction}>
        <label>
          Name: <input name="name" />
        </label>
        <label>
          File: <input type="file" name="file" />
        </label>
        <button>Say Hi</button>
        <Status />
      </form>
      <div>
        {message}
      </div>
    </ErrorBoundary>
  );
}
