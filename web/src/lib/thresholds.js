// The counts more than one reader has to agree on.
//
// They used to be local constants holding the same value in three files - two
// rows here, six links there - which is how a page's breadcrumb once became a
// "destination" in one reader and not in another: nothing kept the copies equal.
// A gate two readers share now moves in one place.
export const TABLE_ROWS = 2; // from here, a page with rows is a table.
export const MENU_LINKS = 6; // from here, a page with links is a menu.
