// In your proc macro crate

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(FromRow)]
pub fn derive_from_row(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let struct_name = &input.ident;

    let fields = match input.data {
        syn::Data::Struct(ref data) => &data.fields,
        _ => panic!("FromRow only works on structs"),
    };

    let field_names = fields.iter().map(|f| {
        let name = f.ident.as_ref().unwrap();
        let column = name.to_string();
        quote! { #name: row.get(#column)? }
    });
    let expanded = quote! {
        impl RecordFromRow for #struct_name {
            fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
                let record = Self {
                    #(#field_names),*
                };
                Ok(record)
            }
        }
    };

    TokenStream::from(expanded)
}
