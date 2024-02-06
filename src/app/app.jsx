import { getLikes, incrementLike } from '../utils/actions';
import { Button } from "./button";

export async function App() {

  const initialValue = await getLikes();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RSC Demo</title>
      </head>
      <body>
        <Button action={incrementLike} initialValue={initialValue} />
      </body>
    </html>
  );

}
