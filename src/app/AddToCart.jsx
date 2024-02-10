export function AddToCart({action, productId}) {
  return (
    <form action={action}>
        <input type="hidden" name="productId" value={productId} />
        <button type="submit">Add to Cart</button>
    </form>

  );
}
