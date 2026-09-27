// Restock form calculations - see components/RestockPricing.

// Same rule as the backend (stock.restock): weighted average of the stock on
// hand and the new units; an empty or negative stock takes the new price.
const averageCost = (product, quantity, unitCost) => {
  const onHand = Math.max(product.product_quantity, 0)
  return Math.round(((onHand * product.product_cp + quantity * unitCost) / (onHand + quantity)) * 100) / 100
}

// Selling price that keeps the product's current margin rate on its new
// average cost (e.g. bought 1000 / sold 1500 -> sold 1.5 x the new cost),
// rounded to the franc. Without a cost to compare to, the current price.
const suggestedSellingPrice = (product, newCost) =>
  product.product_cp > 0 ? Math.round((newCost * product.product_sp) / product.product_cp) : product.product_sp

export const newAverageCost = (product, quantity, unitCost) =>
  product && Number(quantity) > 0 && unitCost !== '' ? averageCost(product, Number(quantity), Number(unitCost)) : null

/** The `selling_price` to send with a restock: what was typed in the field
 * (`edited`, null while untouched), otherwise the suggestion. '' keeps the
 * current selling price. */
export const restockSellingPrice = (product, quantity, unitCost, edited) => {
  if (edited !== null) return edited
  const newCost = newAverageCost(product, quantity, unitCost)
  return newCost !== null ? String(suggestedSellingPrice(product, newCost)) : ''
}
