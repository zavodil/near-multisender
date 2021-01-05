use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::wee_alloc;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, Balance, Promise};
use near_sdk::json_types::{U128};
use std::collections::HashMap;

pub type WrappedBalance = U128;

pub fn ntoy(near_amount: Balance) -> Balance {
    near_amount * 10u128.pow(24)
}

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct Multisender {
    deposits: HashMap<String, Balance>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Operation {
    account_id: AccountId,
    amount: WrappedBalance,
}


#[near_bindgen]
impl Multisender {
    #[payable]
    pub fn multisend_attached_tokens(&mut self, accounts: Vec<Operation>) {
        let tokens: u128 = near_sdk::env::attached_deposit();

        let mut total: Balance = 0;
        for account in &accounts {
            assert!(
                env::is_valid_account_id(account.account_id.as_bytes()),
                "Account @{} is invalid",
                account.account_id
            );

            let amount: Balance = account.amount.into();
            total += amount;
        }

        assert!(
            total <= tokens,
            "Not enough attached tokens to run multisender (Supplied: {}. Demand: {})",
            tokens,
            total
        );

        let direct_logs:bool = accounts.len() < 100;
        let mut logs: String = "".to_string();

        for account in accounts {
            let amount_u128: u128 = account.amount.into();
            Promise::new(account.account_id.clone()).transfer(amount_u128);

            if direct_logs {
                env::log( format!("Sending {} yNEAR to account @{}", amount_u128, account.account_id).as_bytes());
            }
            else{
                let log = format!("Sending {} yNEAR to account @{}\n", amount_u128, account.account_id);
                logs.push_str(&log);
            }
        }

        if !direct_logs {
            env::log(format!("Done!\n{}", logs).as_bytes());
        }
    }

    pub fn multisend_from_balance(&mut self, accounts: Vec<Operation>) {
        let account_id = env::predecessor_account_id();

        assert!(self.deposits.contains_key(&account_id), "Unknown user");

        let tokens: Balance = *self.deposits.get(&account_id).unwrap();
        let mut total: Balance = 0;
        for account in &accounts {
            assert!(
                env::is_valid_account_id(account.account_id.as_bytes()),
                "Account @{} is invalid",
                account.account_id
            );

            let amount: Balance = account.amount.into();
            total += amount;
        }

        assert!(
            total <= tokens,
            "Not enough deposited tokens to run multisender (Supplied: {}. Demand: {})",
            tokens,
            total
        );

        let mut logs: String = "".to_string();
        let mut total_sent: Balance = 0;
        let direct_logs:bool = accounts.len() < 100;

        for account in accounts {
            let amount_u128: u128 = account.amount.into();
            Promise::new(account.account_id.clone()).transfer(amount_u128);

            total_sent += amount_u128;
            let new_balance = tokens - total_sent;
            self.deposits.insert(account_id.clone(), new_balance);

            if direct_logs {
                env::log( format!("Sending {} yNEAR to account @{}", amount_u128, account.account_id).as_bytes());
            }
            else{
                let log = format!("Sending {} yNEAR to account @{}\n", amount_u128, account.account_id);
                logs.push_str(&log);
            }
        }

        if !direct_logs {
            env::log(format!("Done!\n{}", logs).as_bytes());
        }
    }

    #[payable]
    pub fn deposit(&mut self) {
        let attached_tokens: Balance = near_sdk::env::attached_deposit();
        let account_id = env::predecessor_account_id();

        match self.deposits.get(&account_id).cloned() {
            Some(deposit) => {
                self.deposits.insert(account_id, deposit + attached_tokens);
            }
            None => {
                self.deposits.insert(account_id, attached_tokens);
            }
        }
    }

    pub fn withdraw(&mut self) -> Promise {
        let account_id = env::predecessor_account_id();

        assert!(self.deposits.contains_key(&account_id), "Unknown user");

        let tokens: Balance = *self.deposits.get(&account_id).unwrap();
        assert!(tokens > 0, "Nothing to withdraw");

        env::log(
            format!(
                "@{} withdrawing {}",
                account_id, tokens
            )
                .as_bytes(),
        );

        self.deposits.insert(account_id.clone(), 0);
        Promise::new(account_id).transfer(tokens)
    }


    pub fn get_deposit(&self, account_id: String) -> U128 {
        match self.deposits.get(&account_id) {
            Some(deposit) => {
                let value = *deposit;
                let output: U128 = value.into();
                output
            }
            None => {
                0.into()
            }
        }
    }
}

/*
 * The rest of this file holds the inline tests for the code above
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 *
 * To run from contract directory:
 * cargo test -- --nocapture
 *
 * From project root, to run in combination with frontend tests:
 * yarn test
 *
 */
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice_near".to_string(),
            signer_account_id: "bob_near".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "carol_near".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
            epoch_height: 19,
        }
    }

    #[test]
    fn set_then_get_greeting() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = Multisender::default();
        contract.set_greeting("howdy".to_string());
        assert_eq!(
            "howdy".to_string(),
            contract.get_greeting("bob_near".to_string())
        );
    }

    #[test]
    fn get_default_greeting() {
        let context = get_context(vec![], true);
        testing_env!(context);
        let contract = Multisender::default();
// this test did not call set_greeting so should return the default "Hello" greeting
        assert_eq!(
            "Hello".to_string(),
            contract.get_greeting("francis.near".to_string())
        );
    }
}
