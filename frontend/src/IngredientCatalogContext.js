import { createContext, useContext } from 'react';

// Gives deeply-nested editors (IngredientAutocomplete, which is rendered from
// five different recipe editors) a way to create catalog entries without every
// intermediate component having to forward an onCreateIngredient prop.
const IngredientCatalogContext = createContext({ addIngredient: null });

export const IngredientCatalogProvider = IngredientCatalogContext.Provider;

export function useIngredientCatalog() {
  return useContext(IngredientCatalogContext);
}
