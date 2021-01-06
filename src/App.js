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
    const [depositAndSendButtonVisibility, setDepositAndSendButtonVisibility] = React.useState(true);

    // after submitting the form, we want to show Notification
    const [showNotification, setShowNotification] = React.useState("");

    const [accounts, setAccounts] = React.useState({});
    const [deposit, setDeposit] = React.useState(0);
    const [total, setTotal] = React.useState(0);

    const setButtonsVisibility = (accounts, total, deposit, checkOtherButtons) => {
        if (checkOtherButtons === undefined)
            checkOtherButtons = false;

        const accountsLength = accounts ? Object.keys(accounts).length : 0;
        const signedIn = window.walletConnection.isSignedIn();
        setDepositButtonDisabled(!signedIn || !accountsLength || accountsLength < 150 || deposit >= total);
        setSendButtonDisabled(!signedIn || !accountsLength || deposit < total);
        const allButtonsDisabled = checkOtherButtons && depositButtonDisabled && sendButtonDisabled;
        setDepositAndSendButtonDisabled(!signedIn || !accountsLength || accountsLength > 150);
        setDepositAndSendButtonVisibility(allButtonsDisabled || !depositAndSendButtonDisabled);
    };

    const getAccountsText = (accounts) => {
        return Object.keys(accounts).length ?
            Object.keys(accounts).reduce(function (acc, cur) {
                return acc + cur + " " + accounts[cur] + "\r";
            }, "")
            : "";
    };

    const ParsedAccountsList = () => {
        let total = 0;
        let counter = 1;
        return <ul className="accounts">
            {Object.keys(accounts).map(function (account_id) {
                total += Number(accounts[account_id]);
                return <li key={account_id}>
                    <div className="account" title={account_id}>{counter++}. {AccountTrim(account_id)}</div>
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
                <div className="amount">{props.total.toFixed(props.total >= 1 ? 2 : 5)} Ⓝ</div>
            </li>;
        else
            return null
    };

    let parseAmounts = function (input) {
        const pattern = RegExp(/([\_0-9a-zA-Z.]*)[\t,|\||=| ]?([0-9\.]+)/, 'g');
        let accounts = {};
        let result;
        let total = 0;
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
        setTotal(total);
        setAccounts(accounts);
        setButtonsVisibility(accounts, total, deposit, true);
    };


    const GetDeposit = () => {
        window.contract.get_deposit({
            account_id: window.walletConnection.getAccountId()
        }).then((deposit) => {
            deposit = utils.format.formatNearAmount(deposit, FRAC_DIGITS);
            if (deposit)
                setDeposit(deposit);
        });
    };

    // The useEffect hook can be used to fire side-effects during render
    // Learn more: https://reactjs.org/docs/hooks-intro.html
    React.useEffect(
        () => {
            // in this case, we only care to query the contract when signed in
            if (window.walletConnection.isSignedIn())
                GetDeposit();

            const accountsRaw = JSON.parse(window.localStorage.getItem('accounts'));
            let accounts = {};
            if (accountsRaw && accountsRaw.length) {
                let total = 0;
                Object.keys(accountsRaw).map(function (index) {
                    const amount = utils.format.formatNearAmount(accountsRaw[index].amount, FRAC_DIGITS);
                    total += Number(amount);
                    accounts[accountsRaw[index].account_id] = amount;
                });
                setAccounts(accounts);
                setTotal(total);
                setButtonsVisibility(accounts, total, deposit, false);
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
                <h1>Multisender Tool</h1>
                <p>
                    Multisender sends tokens to hundreds of NEAR addresses out in 1 single transaction.
                </p>
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
                    Multisender Tool
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
                  onPaste={async (e) => {
                      fieldset.disabled = true;
                      await parseAmounts(e.clipboardData.getData('Text'));
                      fieldset.disabled = false
                  }}
                  placeholder={["account1.near 3.141592", "account2.near,2.7182", "account3.near=1.41421"].join('\n')}
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
                                className={`deposit-send-button ${depositAndSendButtonVisibility ? "" : "hidden"}`}
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
                                        const tokensToAttach = ConvertToYoctoNear(total);
                                        await window.contract.multisend_attached_tokens({
                                            accounts: multisenderAccounts
                                        }, gas, tokensToAttach);
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

                                        await window.contract.deposit({}, gas, ConvertToYoctoNear(total - deposit));

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
                                {`Deposit ${(total - deposit).toFixed(2)}Ⓝ`}
                            </button>
                        </div>

                        <ParsedAccountsList/>

                    </fieldset>
                </form>
            </main>
            <div className="footer">
                <div className="github">
                    <div className="build-on-near"><a href="https://nearspace.info">BUILD ON NEAR</a></div>
                    NEAR Multisender Tool | <a href="https://github.com/zavodil/near-multisender" rel="nofollow"
                                               target="_blank">Open Source</a>
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

function AccountTrim(account_id) {
    if (account_id.length > 14 + 14 + 1)
        return account_id.slice(0, 14) + '…' + account_id.slice(-14);
    else
        return account_id;
}