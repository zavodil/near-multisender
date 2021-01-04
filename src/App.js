import 'regenerator-runtime/runtime'
import React from 'react'
import {login, logout} from './utils'
import './global.css'
import {utils} from 'near-api-js'
import {BN} from 'bn.js'
import ReactTooltip from 'react-tooltip';

import getConfig from './config'

const {networkId} = getConfig(process.env.NODE_ENV || 'development');

const FRAC_DIGITS = 5;

function ConvertToYoctoNear(amount) {
    return new BN(Math.round(amount * 100000000)).mul(new BN("10000000000000000")).toString();
}

export default function App() {
    // when the user has not yet interacted with the form, disable the button
    const [sendButtonDisabled, setSendButtonDisabled] = React.useState(true);
    const [depositButtonDisabled, setDepositButtonDisabled] = React.useState(true);
    const [depositAndSendButtonDisabled, setDepositAndSendButtonDisabled] = React.useState(true);

    // after submitting the form, we want to show Notification
    const [showNotification, setShowNotification] = React.useState("");

    const [accounts, setAccounts] = React.useState({});
    const [deposit, setDeposit] = React.useState(0);

    let total = 0;

    const setButtonsVisibility = (accounts, total, deposit) => {
        const accountsLength = accounts ? Object.keys(accounts).length : 0;
        const signedIn = window.walletConnection.isSignedIn();
        setDepositAndSendButtonDisabled(!signedIn || !accountsLength || accountsLength > 150);
        setDepositButtonDisabled(!signedIn || !accountsLength || accountsLength < 150 || deposit >= total);
        setSendButtonDisabled(!signedIn || !accountsLength || deposit < total);
    };

    const getAccountsText = (accounts) => {
        return Object.keys(accounts).length ?
            Object.keys(accounts).reduce(function (acc, cur) {
                return acc + cur + " " + accounts[cur] + "\r";
            }, "")
            : "";
    };

    const ParsedAccountsList = () => {
        total = 0;
        return <ul className="accounts">
            {Object.keys(accounts).map(function (account_id) {
                total += Number(accounts[account_id]);
                return <li key={account_id}>
                    <div className="account">{account_id}</div>
                    <div className="amount">{accounts[account_id]} Ⓝ</div>
                </li>
            })}
            <TotalValue total={total}/>
        </ul>;
    };

    const Deposit = () => {
        return deposit && Number(deposit) ? " App Balance: " + deposit + "Ⓝ" : "";
    };

    const TotalValue = (props) => {
        if (props && props.total)
            return <li key="total" className="total">
                <div className="account">Total</div>
                <div className="amount">{props.total.toFixed(2)} Ⓝ</div>
            </li>;
        else
            return null
    };

    let parseAmounts = function (input) {
        const pattern = RegExp(/([0-9a-zA-Z.]*)[,|\||=| ]?([0-9\.]+)/, 'g');
        let accounts = {};
        let result;
        total = 0;
        while ((result = pattern.exec(input)) !== null) {
            if (result[1] && Number(result[2])) {
                const amount = Number(result[2])
                if (accounts.hasOwnProperty(result[1])) {
                    accounts[result[1]] += amount;
                } else
                    accounts[result[1]] = amount;

                total += amount;
            }
        }
        setAccounts(accounts);
        setButtonsVisibility(accounts, total, deposit);
    };


    const GetDeposit= () => {
        window.contract.get_deposit({
            account_id: window.walletConnection.getAccountId()
        }).then((deposit) => {
            deposit = utils.format.formatNearAmount(deposit, FRAC_DIGITS);
            if (deposit)
                setDeposit(deposit);
            setButtonsVisibility(accounts, total, deposit);
        });
    };

    // The useEffect hook can be used to fire side-effects during render
    // Learn more: https://reactjs.org/docs/hooks-intro.html
    React.useEffect(
        () => {
            const accountsRaw = JSON.parse(window.localStorage.getItem('accounts'));
            let accounts = {};
            if (accountsRaw) {
                total = 0;
                Object.keys(accountsRaw).map(function (index) {
                    const amount = utils.format.formatNearAmount(accountsRaw[index].amount, FRAC_DIGITS);
                    total += Number(amount);
                    accounts[accountsRaw[index].account_id] = amount;
                });
                setAccounts(accounts);
                setButtonsVisibility(accounts, total, deposit);
            }

            // in this case, we only care to query the contract when signed in
            if (window.walletConnection.isSignedIn()) {
               GetDeposit();
            }
        },

        // The second argument to useEffect tells React when to re-run the effect
        // Use an empty array to specify "only run on first render"
        // This works because signing into NEAR Wallet reloads the page
        []
    )

    // if not signed in, return early with sign-in prompt
    if (!window.walletConnection.isSignedIn()) {
        return (
            <main>
                <h1>NEAR Multisender</h1>
                <p>
                    To make use of the NEAR blockchain, you need to sign in. The button
                    below will sign you in using NEAR Wallet.
                </p>
                <p style={{textAlign: 'center', marginTop: '2.5em'}}>
                    <button onClick={login}>Sign in</button>
                </p>
            </main>
        )
    }

    return (
        // use React Fragment, <>, to avoid wrapping elements in unnecessary divs
        <>
            <div className="account-header">
                <div className="account-id">{window.accountId}</div>
                <div className="account-deposit" data-tip="Your internal balance in Multisender App"><Deposit/></div>

                <div className="account-sign-out">
                    <button className="link" style={{float: 'right'}} onClick={logout}>
                        Sign out
                    </button>
                </div>
            </div>
            <main>
                <h1>
                    NEAR Multisender Tool
                </h1>
                <form>
                    <fieldset id="fieldset">
                        <label
                            style={{
                                display: 'block',
                                color: 'var(--gray)',
                            }}
                        >
                            Recipients and amounts
                        </label>
                        <label
                            style={{
                                display: 'block',
                                color: 'var(--gray)',
                                fontSize: '0.6em',
                                marginBottom: '0.5em'
                            }}
                        >
                            Enter one address and amount in NEAR on each line. Supports any format.
                        </label>
                        <div style={{display: 'flex'}}>
              <textarea
                  autoComplete="off"
                  id="accounts"
                  defaultValue={getAccountsText(accounts)}
                  onChange={e => parseAmounts(e.target.value)}
                  placeholder={"account1.near 3.141592\n" +
                  "account2.near,2.7182\n" +
                  "account3.near=1.41421"}
                  style={{flex: 1}}
              />
                        </div>

                        <div className="action-buttons">
                            <button
                                disabled={sendButtonDisabled}
                                className={`send-button ${sendButtonDisabled ? "hidden" : ""}`}
                                onClick={async event => {
                                    event.preventDefault()

                                    // disable the form while the value gets updated on-chain
                                    fieldset.disabled = true

                                    try {
                                        let multisenderAccounts = Object.keys(accounts).reduce(function (acc, cur) {
                                            acc.push({account_id: cur, amount: ConvertToYoctoNear(accounts[cur])})
                                            return acc;
                                        }, []);

                                        SaveAccountsToLocalStorage(multisenderAccounts);

                                        let chunks = [];
                                        const chunkSize = 150;
                                        let multisenderAccountsClone = [...multisenderAccounts];
                                        while (multisenderAccountsClone.length > 0)
                                            chunks.push(multisenderAccountsClone.splice(0, chunkSize));

                                        const gas = 300000000000000;
                                        let chunksProcessedCount = 0;
                                        const mapLoop = async _ => {
                                            console.log('Start')
                                            await chunks.map(async currentMultisenderAccounts => {
                                                chunksProcessedCount += 1;
                                                const accountsProcessedCount = chunkSize * chunksProcessedCount;
                                                let multisenderAccountsClone = [...multisenderAccounts];
                                                const remainingAccounts = multisenderAccountsClone.splice(accountsProcessedCount, multisenderAccountsClone.length - accountsProcessedCount);
                                                setAccounts(remainingAccounts);
                                                SaveAccountsToLocalStorage(remainingAccounts);

                                                await window.contract.multisend_from_balance({
                                                    accounts: currentMultisenderAccounts
                                                }, gas).then(() => GetDeposit());

                                                setShowNotification("multisend_from_balance");
                                            });
                                            console.log('End')
                                        };
                                        await mapLoop();
                                    } catch (e) {
                                        alert(
                                            'Something went wrong! \n' +
                                            'Check your browser console for more info.\n' +
                                            e.toString()
                                        )
                                        throw e
                                    } finally {
                                        // re-enable the form, whether the call succeeded or failed
                                        fieldset.disabled = false
                                    }

                                    // show Notification
                                    setShowNotification("multisend_from_balance");

                                    // remove Notification again after css animation completes
                                    // this allows it to be shown again next time the form is submitted
                                    setTimeout(() => {
                                        setShowNotification("")
                                    }, 11000)
                                }}
                                data-tip={"Multi send to all recipients using your internal balance of Multusender App. Your deposit: " + deposit + "Ⓝ"}>
                                Send from App Balance
                            </button>

                            <button
                                disabled={depositAndSendButtonDisabled}
                                className={`deposit-send-button ${depositAndSendButtonDisabled ? "hidden" : ""}`}
                                onClick={async event => {
                                    event.preventDefault()

                                    // disable the form while the value gets updated on-chain
                                    fieldset.disabled = true

                                    try {
                                        let multisenderAccounts = Object.keys(accounts).reduce(function (acc, cur) {
                                            acc.push({account_id: cur, amount: ConvertToYoctoNear(accounts[cur])})
                                            return acc;
                                        }, []);

                                        SaveAccountsToLocalStorage([]);

                                        const gas = 300000000000000;
                                        const tokens = ConvertToYoctoNear(total);
                                        await window.contract.multisend_attached_tokens({
                                            accounts: multisenderAccounts
                                        }, gas, tokens);
                                    } catch (e) {
                                        alert(
                                            'Something went wrong! \n' +
                                            'Check your browser console for more info.\n' +
                                            e.toString()
                                        )
                                        throw e
                                    } finally {
                                        // re-enable the form, whether the call succeeded or failed
                                        fieldset.disabled = false
                                    }

                                    // show Notification
                                    setShowNotification("multisend_attached_tokens");

                                    // remove Notification again after css animation completes
                                    // this allows it to be shown again next time the form is submitted
                                    setTimeout(() => {
                                        setShowNotification("")
                                    }, 11000)
                                }}
                                data-tip="Deposit tokens to the Multisender App and immediately multi send to all recipients">
                                Deposit & Send
                            </button>


                            <button
                                disabled={depositButtonDisabled}
                                className={`deposit-button ${depositButtonDisabled ? "hidden" : ""}`}
                                onClick={async event => {
                                    event.preventDefault()

                                    // disable the form while the value gets updated on-chain
                                    fieldset.disabled = true;

                                    try {
                                        let multisenderAccounts = Object.keys(accounts).reduce(function (acc, cur) {
                                            acc.push({account_id: cur, amount: ConvertToYoctoNear(accounts[cur])})
                                            return acc;
                                        }, []);

                                        SaveAccountsToLocalStorage(multisenderAccounts);

                                        const gas = 10000000000000;

                                        const tokens = ConvertToYoctoNear(total - deposit);

                                        await window.contract.deposit({}, gas, tokens);

                                    } catch (e) {
                                        alert(
                                            'Something went wrong! \n' +
                                            'Check your browser console for more info.\n' +
                                            e.toString()
                                        )
                                        throw e
                                    } finally {
                                        // re-enable the form, whether the call succeeded or failed
                                        fieldset.disabled = false
                                    }

                                    // show Notification
                                    setShowNotification("deposit")

                                    // remove Notification again after css animation completes
                                    // this allows it to be shown again next time the form is submitted
                                    setTimeout(() => {
                                        setShowNotification("")
                                    }, 11000)
                                }}
                                data-tip="Too many tasts for a single transaction. Deposit tokens to the Multisender App and come back to perform multi send">
                                Deposit
                            </button>
                        </div>

                        <ParsedAccountsList/>

                    </fieldset>
                </form>
            </main>
            <div className="footer">
                <div className="github">
                    <div className="build-on-near">BUILD ON NEAR</div>
                    NEAR Multisender app. <a href="https://github.com/zavodil/near-multisender" rel="nofollow" target="_blank">Open Source</a>
                </div>
                <div className="promo">
                    Made by <a href="https://near.zavodil.ru/" rel="nofollow" target="_blank">Zavodil community node</a>
                </div>
            </div>
            {showNotification && <Notification method={showNotification}/>}
            <ReactTooltip/>
        </>
    )
}

function SaveAccountsToLocalStorage(accounts) {
    window.localStorage.setItem('accounts', accounts ? JSON.stringify(accounts) : "[]");
}

// this component gets rendered by App after the form is submitted
function Notification(props) {
    const urlPrefix = `https://explorer.${networkId}.near.org/accounts`
    return (
        <aside>
            <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.accountId}`}>
                {window.accountId}
            </a>
            {' '/* React trims whitespace around tags; insert literal space character when needed */}
            called method: '{props.method}' in contract:
            {' '}
            <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.contract.contractId}`}>
                {window.contract.contractId}
            </a>
            <footer>
                <div>✔ Succeeded</div>
                <div>Just now</div>
            </footer>
        </aside>
    )
}
