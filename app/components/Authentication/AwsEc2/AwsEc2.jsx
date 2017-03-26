import React, { PropTypes } from 'react';
// Material UI
import Dialog from 'material-ui/Dialog';
import TextField from 'material-ui/TextField';
import IconButton from 'material-ui/IconButton';
import FontIcon from 'material-ui/FontIcon';
import { Tabs, Tab } from 'material-ui/Tabs';
import Paper from 'material-ui/Paper';
import { List, ListItem } from 'material-ui/List';
import FlatButton from 'material-ui/FlatButton';
import { Toolbar, ToolbarGroup } from 'material-ui/Toolbar';
import Subheader from 'material-ui/Subheader';
import ActionAccountBox from 'material-ui/svg-icons/action/account-box';
import ActionDelete from 'material-ui/svg-icons/action/delete';
import ActionDeleteForever from 'material-ui/svg-icons/action/delete-forever';
// Styles
import styles from './awsec2.css';
import sharedStyles from '../../shared/styles.css';
import { green500, green400, red500, red300, yellow500, white } from 'material-ui/styles/colors.js';
import Checkbox from 'material-ui/Checkbox';
import { callVaultApi, tokenHasCapabilities } from '../../shared/VaultUtils.jsx';
// Misc
import _ from 'lodash';
import update from 'immutability-helper';
import Avatar from 'material-ui/Avatar';
import { browserHistory } from 'react-router'
import PolicyPicker from '../../shared/PolicyPicker/PolicyPicker.jsx'
import VaultObjectDeleter from '../../shared/DeleteObject/DeleteObject.jsx'

function snackBarMessage(message) {
    let ev = new CustomEvent("snackbar", { detail: { message: message } });
    document.dispatchEvent(ev);
}

export default class AwsEc2AuthBackend extends React.Component {

    ec2ConfigSchema = {
        access_key: '',
        endpoint: undefined,
        secret_key: ''
    };

    roleConfigSchema = {
        role: '',
        bound_ami_id: undefined,
        bound_account_id: undefined,
        bound_region: undefined,
        bound_vpc_id: undefined,
        bound_subnet_id: undefined,
        bound_iam_role_arn: undefined,
        bound_iam_instance_profile_arn: undefined,
        role_tag: undefined,
        ttl: undefined,
        period: undefined,
        policies: [],
        allow_instance_migration: undefined,
        disallow_reauthentication: undefined
    }

    constructor(props) {
        super(props);
        this.state = {
            baseUrl: `/auth/aws-ec2/${this.props.params.namespace}/`,
            baseVaultPath: `auth/${this.props.params.namespace}`,
            ec2Roles: [],
            configObj: this.ec2ConfigSchema,
            newConfigObj: this.ec2ConfigSchema,
            newRoleConfig: this.roleConfigSchema,
            newSecretBtnDisabled: false,
            openNewRoleDialog: false,
            openEditRoleDialog: false,
            deleteUserPath: ''
        };

        _.bindAll(
            this,
            'listEc2Roles',
            'getEc2AuthConfig',
            'createUpdateConfig',
            'createUpdateRole'
        );

    }

    listEc2Roles() {
        tokenHasCapabilities(['list'], `${this.state.baseVaultPath}/role`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/role`, { list: true }, null)
                    .then((resp) => {
                        let roles = resp.data.data.keys;
                        this.setState({ ec2Roles: _.valuesIn(roles) });
                    })
                    .catch(snackBarMessage);
            })
            .catch(() => {
                snackBarMessage(new Error("Access denied"));
            })
    }

    getEc2AuthConfig() {
        callVaultApi('get', `${this.state.baseVaultPath}/config/client`, null, null)
            .then((resp) => {
                let config = resp.data.data;
                this.setState({
                    configObj: update(this.state.configObj,
                        {
                            access_key: { $set: (config.access_key ? config.access_key : null) },
                            endpoint: { $set: config.endpoint },
                            secret_key: { $set: (config.secret_key ? config.secret_key : null) }
                        }),
                    newConfigObj: update(this.state.configObj,
                        {
                            access_key: { $set: (config.access_key ? config.access_key : null) },
                            endpoint: { $set: config.endpoint },
                            secret_key: { $set: (config.secret_key ? config.secret_key : null) }
                        })
                });
            })
            .catch(snackBarMessage);
    }

    createUpdateConfig() {
        callVaultApi('post', `${this.state.baseVaultPath}/config/client`, null, this.state.newConfigObj)
            .then(() => {
                snackBarMessage(`Backend ${this.state.baseVaultPath}/config has been updated`);
            })
            .catch(snackBarMessage);
    }

    createUpdateRole() {
        let updateObj = _.clone(this.state.newRoleConfig);
        updateObj.policies = updateObj.policies.join(',');
        callVaultApi('post', `${this.state.baseVaultPath}/role/${this.state.newRoleConfig.role}`, null, updateObj)
            .then(() => {
                snackBarMessage(`Role ${this.state.newRoleConfig.role} has been updated`);
                this.listEc2Roles();
                this.setState({ openNewRoleDialog: false, openEditRoleDialog: false, newRoleConfig: _.clone(this.roleConfigSchema) });
            })
            .catch(snackBarMessage);
    }

    displayRole() {
        tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/role/${this.state.newRoleConfig.role}`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/role/${this.state.newRoleConfig.role}`, null, null, null)
                    .then((resp) => {
                        resp.data.data.role = this.state.newRoleConfig.role;
                        this.setState({ newRoleConfig: resp.data.data, openEditRoleDialog: true });
                    })
                    .catch(snackBarMessage)
            })
            .catch(() => {
                this.setState({ selectedUserObject: {} })
                snackBarMessage(new Error(`No permissions to display properties for role ${this.state.newRoleConfig.role}`));
            })
    }

    componentDidMount() {
        this.listEc2Roles();
        this.getEc2AuthConfig();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.newRoleConfig.role != prevState.newRoleConfig.role) {
            this.listEc2Roles();
            if (this.state.newRoleConfig.role) {
                this.displayRole();
            }
        }
    }

    render() {
        let renderRoleListItems = () => {
            return _.map(this.state.ec2Roles, (role) => {
                let avatar = (<Avatar icon={<ActionAccountBox />} />);
                let action = (
                    <IconButton
                        tooltip="Delete"
                        onTouchTap={() => this.setState({ deleteUserPath: `${this.state.baseVaultPath}/role/${role}` })}
                    >
                        {window.localStorage.getItem("showDeleteModal") === 'false' ? <ActionDeleteForever color={red500} /> : <ActionDelete color={red500} />}
                    </IconButton>
                );

                let item = (
                    <ListItem
                        key={role}
                        primaryText={role}
                        insetChildren={true}
                        leftAvatar={avatar}
                        rightIconButton={action}
                        onTouchTap={() => {
                            tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/role/${role}`)
                                .then(() => {
                                    this.setState({ newRoleConfig: update(this.state.newRoleConfig, { role: { $set: role } }) });
                                    browserHistory.push(`${this.state.baseUrl}${role}`);
                                }).catch(() => {
                                    snackBarMessage(new Error("Access denied"));
                                })

                        }}
                    />
                )
                return item;
            });
        }

        let renderNewRoleDialog = () => {
            let validateAndSubmit = () => {
                if (this.state.newRoleConfig.role === '') {
                    snackBarMessage(new Error("Role name cannot be empty"));
                    return;
                }

                if (_.indexOf(this.state.ec2Roles, this.state.newRoleConfig.role) > 0) {
                    snackBarMessage(new Error("Role already exists"));
                    return;
                }

                this.createUpdateRole();
                this.setState({ openNewRoleDialog: false, newRoleConfig: _.clone(this.roleConfigSchema) });
            }

            const actions = [
                <FlatButton
                    label="Cancel"
                    onTouchTap={() => {
                        this.setState({ openNewRoleDialog: false, newRoleConfig: _.clone(this.roleConfigSchema) });
                    }}
                />,
                <FlatButton
                    label="Create"
                    primary={true}
                    onTouchTap={validateAndSubmit}
                />
            ];

            return (
                <Dialog
                    title={`Register EC2 role`}
                    modal={false}
                    actions={actions}
                    open={this.state.openNewRoleDialog}
                    onRequestClose={() => this.setState({ openNewRoleDialog: false, newRoleConfig: _.clone(this.roleConfigSchema) })}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <TextField
                            className={styles.textFieldStyle}
                            hintText="Enter the new role name"
                            floatingLabelFixed={true}
                            floatingLabelText="Role Name"
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { role: { $set: e.target.value } }) });
                            }}
                        />
                        <TextField
                            className={styles.textFieldStyle}
                            hintText="optional"
                            floatingLabelFixed={true}
                            floatingLabelText="AMI ID"
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { bound_ami_id: { $set: e.target.value } }) });
                            }}
                        />
                        <TextField
                            className={styles.textFieldStyle}
                            hintText="optional"
                            floatingLabelFixed={true}
                            floatingLabelText="IAM Role ARN"
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { bound_iam_role_arn: { $set: e.target.value } }) });
                            }}
                        />
                        <Subheader>Assigned Policies</Subheader>
                        <PolicyPicker
                            height="200px"
                            selectedPolicies={this.state.newRoleConfig.policies}
                            onSelectedChange={(newPolicies) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { policies: { $set: newPolicies } }) });
                            }}
                        />
                    </List>
                </Dialog>
            );
        }

        let renderEditRoleDialog = () => {
            const actions = [
                <FlatButton
                    label="Cancel"
                    onTouchTap={() => {
                        this.setState({ openEditRoleDialog: false, newRoleConfig: _.clone(this.roleConfigSchema) })
                        browserHistory.push(this.state.baseUrl);
                    }}
                />,
                <FlatButton
                    label="Save"
                    primary={true}
                    onTouchTap={() => {
                        this.createUpdateRole()
                    }}
                />
            ];

            return (
                <Dialog
                    title={`Editing role ${this.state.newRoleConfig.role}`}
                    modal={false}
                    actions={actions}
                    open={this.state.openEditRoleDialog}
                    onRequestClose={() => this.setState({ openEditRoleDialog: false, newRoleConfig: _.clone(this.roleConfigSchema) })}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <TextField
                            className={styles.textFieldStyle}
                            hintText="optional"
                            floatingLabelFixed={true}
                            floatingLabelText="AMI ID"
                            value={this.state.newRoleConfig.bound_ami_id}
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { bound_ami_id: { $set: e.target.value } }) });
                            }}
                        />
                        <TextField
                            className={styles.textFieldStyle}
                            hintText="optional"
                            floatingLabelFixed={true}
                            floatingLabelText="IAM Role ARN"
                            value={this.state.newRoleConfig.bound_iam_role_arn}
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { bound_iam_role_arn: { $set: e.target.value } }) });
                            }}
                        />
                        <Subheader>Assigned Policies</Subheader>
                        <PolicyPicker
                            height="250px"
                            selectedPolicies={this.state.newRoleConfig.policies}
                            onSelectedChange={(newPolicies) => {
                                this.setState({ newRoleConfig: update(this.state.newRoleConfig, { policies: { $set: newPolicies } }) });
                            }}
                        />
                    </List>
                </Dialog>
            );
        }

        return (
            <div>
                {this.state.openEditRoleDialog && renderEditRoleDialog()}
                {this.state.openNewRoleDialog && renderNewRoleDialog()}
                <VaultObjectDeleter
                    path={this.state.deleteUserPath}
                    onReceiveResponse={() => {
                        snackBarMessage(`Object '${this.state.deleteUserPath}' deleted`)
                        this.setState({ deleteUserPath: '' })
                        this.listEc2Roles();
                    }}
                    onReceiveError={(err) => snackBarMessage(err)}
                />
                <Tabs
                    onChange={() => this.setState({ newConfigObj: _.clone(this.state.configObj) })}
                >
                    <Tab label="Configure Roles">
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure EC2 roles.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <Toolbar>
                                <ToolbarGroup firstChild={true}>
                                    <FlatButton
                                        primary={true}
                                        label="NEW ROLE"
                                        disabled={this.state.newSecretBtnDisabled}
                                        onTouchTap={() => {
                                            this.setState({
                                                openNewRoleDialog: true,
                                                newRoleConfig: _.clone(this.roleConfigSchema)
                                            })
                                        }}
                                    />
                                </ToolbarGroup>
                            </Toolbar>
                            <List className={sharedStyles.listStyle}>
                                {renderRoleListItems()}
                            </List>
                        </Paper>
                    </Tab>
                    <Tab label="Configure Backend" >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure connection details to your EC2 account.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <List>
                                <TextField
                                    hintText="AKIAIOSFODNN7EXAMPLE"
                                    floatingLabelText="AWS Access Key ID"
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfigObj.access_key}
                                    onChange={(e) => {
                                        this.setState({ newConfigObj: update(this.state.newConfigObj, { access_key: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                    floatingLabelText="AWS Secret Access Key"
                                    fullWidth={true}
                                    type="password"
                                    floatingLabelFixed={true}
                                    value={this.state.newConfigObj.secret_key}
                                    onChange={(e) => {
                                        this.setState({ newConfigObj: update(this.state.newConfigObj, { secret_key: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText="Override with caution"
                                    floatingLabelText="Endpoint for making AWS EC2 API calls"
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfigObj.endpoint}
                                    onChange={(e) => {
                                        this.setState({ newConfigObj: update(this.state.newConfigObj, { endpoint: { $set: e.target.value } }) });
                                    }}
                                />
                                <div style={{ paddingTop: '20px', textAlign: 'center' }}>
                                    <FlatButton
                                        primary={true}
                                        label="Save"
                                        onTouchTap={() => this.createUpdateConfig()}
                                    />
                                </div>
                            </List>
                        </Paper>
                    </Tab>
                </Tabs>
            </div>
        );
    }
}