import pandas as pd


def waste_read(path, columns):
    df = pd.read_excel(path, usecols=columns)
    df.dropna(subset=["批号"], inplace=True)
    df["批号"] = df["批号"].astype(str)
    df_grouped = dict(tuple(df.groupby("规格")))
    return df_grouped


def file_read_all(path_s, path_t, path_h, path_z, S_cols, T_cols, H_cols, Z_cols):
    df_s = pd.read_excel(path_s, usecols=S_cols)
    df_t = pd.read_excel(path_t, usecols=T_cols)
    df_h = pd.read_excel(path_h, usecols=H_cols)
    df_z = pd.read_excel(path_z, usecols=Z_cols)
    return df_s, df_t, df_h, df_z


def read_file_sub(path, columns):
    return pd.read_excel(path, usecols=columns)


def get_ids(df: pd.DataFrame):
    return df.iloc[:, 0].dropna().astype(str).tolist()


def get_dict_t(df: pd.DataFrame):
    df.dropna(inplace=True)
    df["产品规格型号"] = df["产品规格型号"].astype(str)
    df_grouped = df.groupby("产品规格型号")["数量"].sum().to_dict()
    return list(df_grouped.keys()), df_grouped


def get_dict_h(df: pd.DataFrame, special_dict: dict):
    df.dropna(inplace=True)
    df["规格型号"] = df["规格型号"].astype(str)
    result = {}
    ids = df["规格型号"].unique().tolist()
    for id_ in ids:
        if id_ in special_dict:
            name = special_dict[id_]
            temp = df[(df["规格型号"] == id_) & (df["产品名称"] == name)]
        else:
            temp = df[df["规格型号"] == id_]
        result[id_] = temp["数量"].sum()
    return ids, result


def get_dict_z(df: pd.DataFrame, special_dict: dict):
    df.dropna(inplace=True)
    df["规格型号"] = df["规格型号"].astype(str)
    result = {}
    ids = df["规格型号"].unique().tolist()
    for id_ in ids:
        if id_ in special_dict:
            name = special_dict[id_]
            temp = df[(df["规格型号"] == id_) & (df["产品名称"] == name)]
        else:
            temp = df[df["规格型号"] == id_]
        result[id_] = temp["在线盘点数量<主计量>"].sum()
    return ids, result


def get_dict_id_and_batch_num(ids, df):
    result = {}
    for id_ in ids:
        temp = df[df["规格型号"].astype(str) == id_]
        batch_nums = temp["批号"].dropna().astype(str).unique().tolist()
        result[id_] = batch_nums
    return result


def get_dict_w(dict_tantiao, ids, w_args):
    result = {}
    for id_ in ids:
        result[id_] = {}
        batch_nums = ids[id_]
        df = dict_tantiao.get(id_)
        if df is None:
            continue
        df = df[df["批号"].isin(batch_nums)]
        for category, cols in w_args.items():
            result[id_][category] = df[cols].sum().sum()
    return result